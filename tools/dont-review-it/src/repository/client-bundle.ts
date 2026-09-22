#!/usr/bin/env node
const { mkdtemp, readFile, readdir, rm } = process.getBuiltinModule("fs/promises");
const { tmpdir } = process.getBuiltinModule("os");
const path = process.getBuiltinModule("path");
const { fileURLToPath } = process.getBuiltinModule("url");

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { type Application, ApplicationName } from "@repo/config";
import { serverOnlyMarkers } from "@repo/vite-config";
import { Console, Effect, Schema } from "effect";
import { build } from "vite-plus";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const probeModules: Readonly<Record<Application, string>> = {
  "internal-dashboard": "src/pages/login/ui/wiki-login.tsx",
  "service-admin": "src/pages/login/ui/admin-login.tsx",
  "service-member": "src/pages/public/landing/ui/hero.tsx",
};

const Arguments = Schema.Struct({
  application: ApplicationName,
});

const clientReachable: readonly string[] = [
  "@repo/runtime/client",
  "@repo/auth-ui",
  "@repo/ui",
  "#shared/api/client.ts",
];
const serverOnly: readonly (readonly [string, string])[] = [
  ["@repo/runtime/http", "**/libs/runtime/src/**"],
  ["@repo/runtime/worker", "**/libs/runtime/src/**"],
  ["@repo/runtime/account", "**/libs/runtime/src/**"],
  ["@repo/db", "**/libs/db/src/**"],
  ["@repo/auth", "**/libs/auth/src/**"],
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
  application: Application,
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
  } finally {
    await rm(path.join(appRoot, "dist"), { force: true, recursive: true });
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
  application: Application,
  [specifier, pattern]: readonly [string, string],
): Effect.Effect<readonly string[]> {
  return Effect.scoped(
    temporaryOutput.pipe(
      Effect.flatMap((outDirectory) =>
        Effect.promise(async () => clientBuild(application, [specifier], outDirectory)),
      ),
      Effect.map((denial) =>
        denial === pattern
          ? []
          : [`${specifier} denied by ${denial || "nothing"} instead of ${pattern}`],
      ),
    ),
  );
}

const inspect = (application: Application) =>
  Effect.gen(function* inspect() {
    const reachableDirectory = yield* temporaryOutput;
    const reachableDenial = yield* Effect.promise(async () =>
      clientBuild(application, clientReachable, reachableDirectory),
    );
    const markers = yield* Effect.promise(async () => bundledMarkers(reachableDirectory));
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
    const arguments_ = yield* Schema.decodeUnknownEffect(Arguments)({
      application: process.argv[2] === "--application" ? process.argv[3] : undefined,
    });
    const unexpected = yield* inspect(arguments_.application);
    yield* Console.log(
      JSON.stringify({
        application: arguments_.application,
        event: "quality.client_bundle",
        inputs: clientReachable.length + serverOnly.length,
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
