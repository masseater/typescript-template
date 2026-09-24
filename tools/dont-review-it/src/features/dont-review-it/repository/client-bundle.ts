#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { type BuildTarget, BuildTargetName } from "@repo/config";
import { serverOnlyMarkers } from "@repo/vite-config";
import { Console, Effect, FileSystem, Path, Schema } from "effect";
import { build } from "vite-plus";

import { denialReason } from "./client-bundle-denial.ts";
import { repositoryRoot } from "./repository-root.ts";

const probeModules: Readonly<Record<BuildTarget, string>> = {
  "internal-dashboard": "src/pages/login/ui/wiki-login.tsx",
  "internal-wiki": "src/widgets/wiki-frame/ui/wiki-frame.tsx",
  "service-admin": "src/pages/login/ui/admin-login.tsx",
  "service-member": "src/pages/public/landing/ui/hero.tsx",
};

const sharedClientReachable: readonly string[] = [
  "@repo/runtime/client",
  "@repo/auth-ui",
  "@repo/ui",
];
const clientReachableOf: Readonly<Record<BuildTarget, readonly string[]>> = {
  "internal-dashboard": [...sharedClientReachable, "#shared/api/client.ts"],
  "internal-wiki": sharedClientReachable,
  "service-admin": [...sharedClientReachable, "#shared/api/client.ts"],
  "service-member": [...sharedClientReachable, "#shared/api/client.ts"],
};
const serverOnly: readonly (readonly [string, string])[] = [
  ["@repo/runtime/http", "**/libs/runtime/src/features/runtime/**"],
  ["@repo/runtime/worker", "**/libs/runtime/src/features/runtime/**"],
  ["@repo/runtime/account", "**/libs/runtime/src/features/runtime/**"],
  ["@repo/db", "**/libs/db/src/features/db/**"],
  ["@repo/auth", "**/libs/auth/src/features/auth/**"],
  ["#shared/server-api/index.ts", "**/src/**/server-api/**"],
];

class BuildDenied extends Schema.TaggedError<BuildDenied>()("BuildDenied", {
  reason: Schema.String,
}) {}

const clientBuild = (
  application: BuildTarget,
  specifiers: readonly string[],
  outDirectory: string,
): Effect.Effect<string, never, Path.Path> =>
  Effect.gen(function* clientBuild() {
    const paths = yield* Path.Path;
    const appRoot = paths.join(repositoryRoot, "apps", application);
    const probeModule = paths.join(appRoot, probeModules[application]);
    return yield* Effect.tryPromise({
      catch: (error) => new BuildDenied({ reason: denialReason(error) }),
      try: () =>
        build({
          build: { emptyOutDir: true, outDir: outDirectory },
          configFile: paths.join(appRoot, "vite.config.ts"),
          logLevel: "silent",
          plugins: [
            {
              applyToEnvironment: (environment: Readonly<{ name: string }>): boolean =>
                environment.name === "client",
              enforce: "post",
              name: "client-bundle-probe",
              transform(code: string, id: string) {
                if (id !== probeModule) {
                  return;
                }
                const injected = specifiers
                  .map((specifier) => `import ${JSON.stringify(specifier)};`)
                  .join("\n");
                return { code: `${injected}\n${code}`, map: { mappings: "" } };
              },
            },
          ],
          root: appRoot,
        }),
    }).pipe(
      Effect.match({
        onFailure: (denied) => denied.reason,
        onSuccess: () => "",
      }),
    );
  });

const bundledMarkers = (outDirectory: string) =>
  Effect.gen(function* bundledMarkers() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const entries = yield* filesystem.readDirectory(outDirectory, { recursive: true });
    const sources = yield* Effect.forEach(
      entries.filter((entry) => entry.endsWith(".js")),
      (entry) => filesystem.readFileString(paths.join(outDirectory, entry)),
      { concurrency: "unbounded" },
    );
    return serverOnlyMarkers.filter((marker) => sources.some((source) => source.includes(marker)));
  });

const temporaryOutput = Effect.gen(function* temporaryOutput() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectoryScoped({ prefix: "template-client-bundle-" });
});

const undeclaredProblems = (specifier: string, denial: string): readonly string[] =>
  denial === "" ? [`${specifier} reached the client bundle undeclared`] : [];

const mismatchedProblems = (
  specifier: string,
  pattern: string,
  denial: string,
): readonly string[] =>
  denial === pattern ? [] : [`${specifier} denied by ${denial || "nothing"} instead of ${pattern}`];

const denialProblems = (
  specifier: string,
  pattern: string | undefined,
  denial: string,
): readonly string[] =>
  pattern === undefined
    ? undeclaredProblems(specifier, denial)
    : mismatchedProblems(specifier, pattern, denial);

const serverOnlyProblems = (
  application: BuildTarget,
  [specifier, pattern]: readonly [string, string | undefined],
) =>
  Effect.scoped(
    temporaryOutput.pipe(
      Effect.flatMap((outDirectory) => clientBuild(application, [specifier], outDirectory)),
      Effect.map((denial) => denialProblems(specifier, pattern, denial)),
    ),
  );

const Manifest = Schema.Struct({
  dependencies: Schema.Record(Schema.String, Schema.String),
});

const expectedDenials = (application: BuildTarget) =>
  Effect.gen(function* expectedDenials() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const manifestText = yield* filesystem.readFileString(
      paths.join(repositoryRoot, "apps", application, "package.json"),
    );
    const { dependencies } = yield* Schema.decodeEffect(Schema.fromJsonString(Manifest))(
      manifestText,
    );
    return serverOnly.map(([specifier, pattern]) =>
      specifier.startsWith("#") || specifier.split("/").slice(0, 2).join("/") in dependencies
        ? ([specifier, pattern] as const)
        : ([specifier, undefined] as const),
    );
  });

const inspect = (application: BuildTarget) =>
  Effect.gen(function* inspect() {
    const reachable = clientReachableOf[application];
    const reachableDirectory = yield* temporaryOutput;
    const reachableDenial = yield* clientBuild(application, reachable, reachableDirectory);
    const markers = yield* bundledMarkers(reachableDirectory);
    const checked = yield* expectedDenials(application);
    const denials = yield* Effect.forEach(checked, (entry) =>
      serverOnlyProblems(application, entry),
    );
    const unexpected = [
      ...(reachableDenial === "" ? [] : [`${reachable.join(" ")} denied by ${reachableDenial}`]),
      ...markers.map((marker) => `${marker} reached the client bundle`),
      ...denials.flat(),
    ];
    return { inputs: reachable.length + checked.length, unexpected };
  }).pipe(Effect.scoped);

runCli(
  Effect.gen(function* run() {
    const paths = yield* Path.Path;
    const application = yield* Schema.decodeUnknownEffect(BuildTargetName)(
      paths.basename(process.cwd()),
    );
    const { inputs, unexpected } = yield* inspect(application);
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        application,
        event: "quality.client_bundle",
        inputs,
        ok: unexpected.length === 0,
        unexpected,
      }),
    );
    if (unexpected.length > 0) {
      yield* markFailed;
    }
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord("quality.client_bundle_failed", { cause }),
);
