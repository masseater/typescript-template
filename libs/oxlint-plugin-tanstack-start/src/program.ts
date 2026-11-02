import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, Layer, ManagedRuntime, Option, Path } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization, OtlpTracer } from "effect/observability";
import ts from "typescript";

const tracing = OtlpTracer.layerFromConfig({
  resource: { serviceName: "oxlint-plugin-tanstack-start" },
}).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer));

const runtime = ManagedRuntime.make(Layer.mergeAll(tracing, NodeServices.layer));

process.once("beforeExit", () => {
  Effect.runFork(runtime.disposeEffect);
});

const sourceFiles = new Map<string, ts.SourceFile>();

const cachingHost = (options: ts.CompilerOptions): ts.CompilerHost => {
  const host = ts.createCompilerHost(options, true);
  return {
    ...host,
    getSourceFile: (...args) => {
      const [fileName, languageVersion] = args;
      const key = `${fileName}\0${JSON.stringify(languageVersion)}`;
      return Option.fromNullishOr(sourceFiles.get(key)).pipe(
        Option.orElse(() =>
          Option.fromNullishOr(host.getSourceFile(...args)).pipe(
            Option.tap((created) => Option.some(sourceFiles.set(key, created))),
          ),
        ),
        Option.getOrUndefined,
      );
    },
  };
};

const ignoreUnrecoverable = (): void => {
  Option.none();
};

const parseConfig = (configPath: string): Option.Option<ts.ParsedCommandLine> =>
  Option.fromNullishOr(
    ts.getParsedCommandLineOfConfigFile(
      configPath,
      {},
      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: ignoreUnrecoverable },
    ),
  );

interface Overlay {
  readonly fileName: string;
  readonly text: string;
}

const overlayHost = (host: ts.CompilerHost, overlay: Overlay): ts.CompilerHost => ({
  ...host,
  fileExists: (fileName) => fileName === overlay.fileName || host.fileExists(fileName),
  readFile: (fileName) =>
    Option.match(
      Option.liftPredicate(fileName, (name) => name === overlay.fileName),
      {
        onNone: () => host.readFile(fileName),
        onSome: () => overlay.text,
      },
    ),
  getSourceFile: (...args) => {
    const [fileName, languageVersion] = args;
    return Option.match(
      Option.liftPredicate(fileName, (name) => name === overlay.fileName),
      {
        onNone: () => host.getSourceFile(...args),
        onSome: () => ts.createSourceFile(fileName, overlay.text, languageVersion, true),
      },
    );
  },
});

const withProjectReferences = (
  config: ts.ParsedCommandLine,
): Readonly<{ projectReferences?: readonly ts.ProjectReference[] }> =>
  Option.match(Option.fromNullishOr(config.projectReferences), {
    onNone: () => ({}),
    onSome: (projectReferences) => ({ projectReferences }),
  });

const buildProgram = (configPath: string): Effect.Effect<Option.Option<BaseProgram>> =>
  Effect.sync(() =>
    parseConfig(configPath).pipe(
      Option.map((config) => ({
        config,
        program: ts.createProgram({
          rootNames: config.fileNames,
          options: config.options,
          host: cachingHost(config.options),
          ...withProjectReferences(config),
        }),
      })),
    ),
  ).pipe(Effect.withSpan("tanstack-start.build-program", { attributes: { configPath } }));

interface BaseProgram {
  readonly config: ts.ParsedCommandLine;
  readonly program: ts.Program;
}

const programs = new Map<string, Option.Option<BaseProgram>>();

const cachedProgram = (configPath: string): Effect.Effect<Option.Option<BaseProgram>> =>
  Option.fromNullishOr(programs.get(configPath)).pipe(
    Option.match({
      onSome: Effect.succeed,
      onNone: () =>
        buildProgram(configPath).pipe(
          Effect.tap((built) => Effect.sync(() => programs.set(configPath, built))),
        ),
    }),
  );

const overlays = new Map<string, ts.Program>();

const buildOverlayProgram = (
  configPath: string,
  base: BaseProgram,
  overlay: Overlay,
): Effect.Effect<ts.Program> =>
  Effect.sync(() =>
    ts.createProgram({
      rootNames: [...new Set([...base.config.fileNames, overlay.fileName])],
      options: base.config.options,
      host: overlayHost(cachingHost(base.config.options), overlay),
      oldProgram: base.program,
      ...withProjectReferences(base.config),
    }),
  ).pipe(
    Effect.tap((program) => Effect.sync(() => overlays.set(configPath, program))),
    Effect.withSpan("tanstack-start.build-overlay-program", {
      attributes: { fileName: overlay.fileName },
    }),
  );

const matchesText = (program: ts.Program, overlay: Overlay): boolean =>
  Option.fromNullishOr(program.getSourceFile(overlay.fileName)).pipe(
    Option.exists((sourceFile) => sourceFile.getFullText() === overlay.text),
  );

const programWithText = (
  configPath: string,
  base: BaseProgram,
  overlay: Overlay,
): Effect.Effect<ts.Program> =>
  Option.liftPredicate(base.program, (program) => matchesText(program, overlay)).pipe(
    Option.orElse(() =>
      Option.fromNullishOr(overlays.get(configPath)).pipe(
        Option.filter((program) => matchesText(program, overlay)),
      ),
    ),
    Option.match({
      onSome: Effect.succeed,
      onNone: () => buildOverlayProgram(configPath, base, overlay),
    }),
  );

const fileExists = (fileName: string): boolean => ts.sys.fileExists(fileName);

const programOfFile = (
  overlay: Overlay,
): Effect.Effect<Option.Option<ts.Program>, never, Path.Path> =>
  Effect.gen(function* findProgram() {
    const path = yield* Path.Path;
    const configPath = Option.fromNullishOr(
      ts.findConfigFile(path.dirname(overlay.fileName), fileExists),
    );
    return yield* Option.match(configPath, {
      onNone: () => Effect.succeedNone,
      onSome: (found) =>
        cachedProgram(found).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeedNone,
              onSome: (base) => programWithText(found, base, overlay).pipe(Effect.asSome),
            }),
          ),
        ),
    });
  });

const programFor = (overlay: Overlay): Option.Option<ts.Program> =>
  Exit.match(runtime.runSyncExit(programOfFile(overlay)), {
    onSuccess: (program) => program,
    onFailure: (cause) => {
      throw Cause.squash(cause);
    },
  });

export type { Overlay };
export { programFor };
