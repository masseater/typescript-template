#!/usr/bin/env node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { causeRecord, markFailed, runCli } from "@repo/cli";
import { serverOnlyMarkers } from "@repo/vite-config";
import { Console, Effect } from "effect";
import { build } from "vite-plus";

const appRoot = fileURLToPath(new URL("../../../../apps/service-member/", import.meta.url));
const probeModule = path.join(appRoot, "src/pages/landing/ui/hero.tsx");

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

async function clientBuild(specifiers: readonly string[], outDirectory: string): Promise<string> {
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

function serverOnlyProblems([specifier, pattern]: readonly [string, string]): Effect.Effect<
  readonly string[]
> {
  return Effect.scoped(
    temporaryOutput.pipe(
      Effect.flatMap((outDirectory) =>
        Effect.promise(async () => clientBuild([specifier], outDirectory)),
      ),
      Effect.map((denial) =>
        denial === pattern
          ? []
          : [`${specifier} denied by ${denial || "nothing"} instead of ${pattern}`],
      ),
    ),
  );
}

const inspect = Effect.gen(function* inspect() {
  const reachableDirectory = yield* temporaryOutput;
  const reachableDenial = yield* Effect.promise(async () =>
    clientBuild(clientReachable, reachableDirectory),
  );
  const markers = yield* Effect.promise(async () => bundledMarkers(reachableDirectory));
  const denials = yield* Effect.forEach(serverOnly, serverOnlyProblems);
  return [
    ...(reachableDenial === ""
      ? []
      : [`${clientReachable.join(" ")} denied by ${reachableDenial}`]),
    ...markers.map((marker) => `${marker} reached the client bundle`),
    ...denials.flat(),
  ];
}).pipe(Effect.scoped);

runCli(
  inspect.pipe(
    Effect.flatMap((unexpected) =>
      Console.log(
        JSON.stringify({
          event: "quality.client_bundle",
          inputs: clientReachable.length + serverOnly.length,
          ok: unexpected.length === 0,
          unexpected,
        }),
      ).pipe(Effect.andThen(unexpected.length > 0 ? markFailed : Effect.void)),
    ),
  ),
  (cause) => causeRecord("quality.client_bundle_failed", { cause }),
);
