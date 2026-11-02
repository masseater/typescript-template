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

const buildProgram = (configPath: string): Effect.Effect<Option.Option<ts.Program>> =>
  Effect.sync(() =>
    parseConfig(configPath).pipe(
      Option.map((config) =>
        ts.createProgram({
          rootNames: config.fileNames,
          options: config.options,
          host: cachingHost(config.options),
          ...Option.match(Option.fromNullishOr(config.projectReferences), {
            onNone: () => ({}),
            onSome: (projectReferences) => ({ projectReferences }),
          }),
        }),
      ),
    ),
  ).pipe(Effect.withSpan("tanstack-start.build-program", { attributes: { configPath } }));

const programs = new Map<string, Option.Option<ts.Program>>();

const cachedProgram = (configPath: string): Effect.Effect<Option.Option<ts.Program>> =>
  Option.fromNullishOr(programs.get(configPath)).pipe(
    Option.match({
      onSome: Effect.succeed,
      onNone: () =>
        buildProgram(configPath).pipe(
          Effect.tap((built) => Effect.sync(() => programs.set(configPath, built))),
        ),
    }),
  );

const fileExists = (fileName: string): boolean => ts.sys.fileExists(fileName);

const programOfFile = (
  fileName: string,
): Effect.Effect<Option.Option<ts.Program>, never, Path.Path> =>
  Effect.gen(function* findProgram() {
    const path = yield* Path.Path;
    const configPath = Option.fromNullishOr(ts.findConfigFile(path.dirname(fileName), fileExists));
    return yield* Option.match(configPath, {
      onNone: () => Effect.succeedNone,
      onSome: cachedProgram,
    });
  });

const programFor = (fileName: string): Option.Option<ts.Program> =>
  Exit.match(runtime.runSyncExit(programOfFile(fileName)), {
    onSuccess: (program) => program,
    onFailure: (cause) => {
      throw Cause.squash(cause);
    },
  });

export { programFor };
