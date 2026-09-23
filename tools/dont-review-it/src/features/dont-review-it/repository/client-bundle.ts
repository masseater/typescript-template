#!/usr/bin/env node
const { mkdtemp, readFile, readdir, rm } = process.getBuiltinModule("fs/promises");
const { tmpdir } = process.getBuiltinModule("os");
const path = process.getBuiltinModule("path");

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { type BuildTarget, BuildTargetName } from "@repo/config";
import { serverOnlyMarkers } from "@repo/vite-config";
import { Console, Effect, Schema } from "effect";
import { build } from "vite-plus";

import { repositoryRoot } from "./repository-root.ts";

const probeModules: Readonly<Record<BuildTarget, string>> = {
  "internal-dashboard": "src/pages/login/ui/wiki-login.tsx",
  "internal-wiki": "src/widgets/wiki-frame/ui/wiki-frame.tsx",
  "service-admin": "src/pages/login/ui/admin-login.tsx",
  "service-member": "src/pages/landing/ui/hero.tsx",
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

function denialReason(error: unknown): string {
  const text = String(error);
  return (
    /Denied by file pattern: (?<pattern>\S+)/u.exec(text)?.groups?.["pattern"] ??
    /Denied by specifier pattern: (?<pattern>\S+)/u.exec(text)?.groups?.["pattern"] ??
    (text.includes("Denied by marker") ? "marker" : "denied")
  );
}

async function clientBuild(
  application: BuildTarget,
  specifiers: readonly string[],
  outDirectory: string,
): Promise<string> {
  const appRoot = path.join(repositoryRoot, "apps", application);
  const probeModule = path.join(appRoot, probeModules[application]);
  try {
    await build({
      build: { emptyOutDir: true, outDir: outDirectory },
      configFile: path.join(appRoot, "vite.config.ts"),
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
    });
    return "";
  } catch (error: unknown) {
    return denialReason(error);
  }
}

async function bundledMarkers(outDirectory: string): Promise<readonly string[]> {
  const entries = await readdir(outDirectory, { recursive: true });
  const sources = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".js"))
      .map(async (entry) => readFile(path.join(outDirectory, entry), "utf-8")),
  );
  return serverOnlyMarkers.filter((marker) => sources.some((source) => source.includes(marker)));
}

const temporaryOutput = Effect.acquireRelease(
  Effect.promise(async () => mkdtemp(path.join(tmpdir(), "template-client-bundle-"))),
  (directory) => Effect.promise(async () => rm(directory, { force: true, recursive: true })),
);

function serverOnlyProblems(
  application: BuildTarget,
  [specifier, pattern]: readonly [string, string | undefined],
): Effect.Effect<readonly string[]> {
  return Effect.scoped(
    temporaryOutput.pipe(
      Effect.flatMap((outDirectory) =>
        Effect.promise(async () => clientBuild(application, [specifier], outDirectory)),
      ),
      Effect.map((denial) => {
        if (pattern === undefined) {
          return denial === "" ? [`${specifier} reached the client bundle undeclared`] : [];
        }
        return denial === pattern
          ? []
          : [`${specifier} denied by ${denial || "nothing"} instead of ${pattern}`];
      }),
    ),
  );
}

const Manifest = Schema.Struct({
  dependencies: Schema.Record(Schema.String, Schema.String),
});

const expectedDenials = (
  application: BuildTarget,
): Effect.Effect<readonly (readonly [string, string | undefined])[]> =>
  Effect.promise(async () =>
    readFile(path.join(repositoryRoot, "apps", application, "package.json"), "utf-8"),
  ).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Manifest))),
    Effect.orDie,
    Effect.map(({ dependencies }) =>
      serverOnly.map(([specifier, pattern]) =>
        specifier.startsWith("#") || specifier.split("/").slice(0, 2).join("/") in dependencies
          ? ([specifier, pattern] as const)
          : ([specifier, undefined] as const),
      ),
    ),
  );

const inspect = (application: BuildTarget) =>
  Effect.gen(function* inspect() {
    const reachableDirectory = yield* temporaryOutput;
    const reachableDenial = yield* Effect.promise(async () =>
      clientBuild(application, clientReachableOf[application], reachableDirectory),
    );
    const markers = yield* Effect.promise(async () => bundledMarkers(reachableDirectory));
    const checked = yield* expectedDenials(application);
    const denials = yield* Effect.forEach(checked, (entry) =>
      serverOnlyProblems(application, entry),
    );
    const unexpected = [
      ...(reachableDenial === ""
        ? []
        : [`${clientReachableOf[application].join(" ")} denied by ${reachableDenial}`]),
      ...markers.map((marker) => `${marker} reached the client bundle`),
      ...denials.flat(),
    ];
    return { inputs: clientReachableOf[application].length + checked.length, unexpected };
  }).pipe(Effect.scoped);

runCli(
  Effect.gen(function* run() {
    const application = yield* Schema.decodeUnknownEffect(BuildTargetName)(
      path.basename(process.cwd()),
    );
    const { inputs, unexpected } = yield* inspect(application);
    yield* Console.log(
      JSON.stringify({
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
  }),
  (cause) => causeRecord("quality.client_bundle_failed", { cause }),
);
