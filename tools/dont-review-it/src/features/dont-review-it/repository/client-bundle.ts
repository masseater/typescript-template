#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { type Application, ApplicationName } from "@repo/config";
import { serverOnlyMarkers } from "@repo/vite-config";
import { Console, Effect, FileSystem, Path, Schema } from "effect";
import { build } from "vite-plus";

import { repositoryRoot } from "./repository-root.ts";

const probeModules: Readonly<Record<Application, string>> = {
  "internal-dashboard": "src/pages/login/ui/wiki-login.tsx",
  "service-admin": "src/pages/login/ui/admin-login.tsx",
  "service-member": "src/pages/landing/ui/hero.tsx",
};

const clientReachable: readonly string[] = [
  "@repo/runtime/client",
  "@repo/auth-ui",
  "@repo/ui",
  "#shared/api/client.ts",
];
const serverOnly: readonly (readonly [string, string])[] = [
  ["@repo/runtime/http", "**/libs/runtime/src/features/runtime/**"],
  ["@repo/runtime/worker", "**/libs/runtime/src/features/runtime/**"],
  ["@repo/runtime/account", "**/libs/runtime/src/features/runtime/**"],
  ["@repo/db", "**/libs/db/src/features/db/**"],
  ["@repo/auth", "**/libs/auth/src/features/auth/**"],
  ["#shared/server-api/index.ts", "**/src/**/server-api/**"],
];

function denialReason(error: unknown): string {
  const text = String(error);
  return (
    /Denied by file pattern: (?<pattern>\S+)/u.exec(text)?.groups?.["pattern"] ??
    /Denied by specifier pattern: (?<pattern>\S+)/u.exec(text)?.groups?.["pattern"] ??
    (text.includes("Denied by marker") ? "marker" : "denied")
  );
}

class BuildDenied extends Schema.TaggedError<BuildDenied>()("BuildDenied", {
  reason: Schema.String,
}) {}

const clientBuild = (
  application: Application,
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

const serverOnlyProblems = (
  application: Application,
  [specifier, pattern]: readonly [string, string],
) =>
  Effect.scoped(
    temporaryOutput.pipe(
      Effect.flatMap((outDirectory) => clientBuild(application, [specifier], outDirectory)),
      Effect.map((denial) =>
        denial === pattern
          ? []
          : [`${specifier} denied by ${denial || "nothing"} instead of ${pattern}`],
      ),
    ),
  );

const inspect = (application: Application) =>
  Effect.gen(function* inspect() {
    const reachableDirectory = yield* temporaryOutput;
    const reachableDenial = yield* clientBuild(application, clientReachable, reachableDirectory);
    const markers = yield* bundledMarkers(reachableDirectory);
    const denials = yield* Effect.forEach(serverOnly, (entry) =>
      serverOnlyProblems(application, entry),
    );
    return [
      ...(reachableDenial === ""
        ? []
        : [`${clientReachable.join(" ")} denied by ${reachableDenial}`]),
      ...markers.map((marker) => `${marker} reached the client bundle`),
      ...denials.flat(),
    ];
  }).pipe(Effect.scoped);

runCli(
  Effect.gen(function* run() {
    const paths = yield* Path.Path;
    const application = yield* Schema.decodeUnknownEffect(ApplicationName)(
      paths.basename(process.cwd()),
    );
    const unexpected = yield* inspect(application);
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        application,
        event: "quality.client_bundle",
        inputs: clientReachable.length + serverOnly.length,
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
