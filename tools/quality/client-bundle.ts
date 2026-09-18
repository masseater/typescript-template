// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { build } from "vite-plus";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { serverOnlyMarkers } from "@template/config/vite";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const appRoot = fileURLToPath(new URL("../../apps/user/", import.meta.url));
const probeModule = path.join(appRoot, "src/pages/landing/ui/hero.tsx");
const outDirectory = await mkdtemp(path.join(tmpdir(), "template-client-bundle-"));

const clientReachable: readonly string[] = [
  "@template/runtime/client",
  "@template/runtime/contracts",
  "@template/ui",
  "#shared/api/client.ts",
];
const serverOnly: readonly (readonly [string, string])[] = [
  ["@template/runtime/http", "**/libs/runtime/src/**"],
  ["@template/runtime/worker", "**/libs/runtime/src/**"],
  ["@template/runtime/account", "**/libs/runtime/src/**"],
  ["@template/runtime/wiki", "**/libs/runtime/src/**"],
  ["@template/db", "**/libs/db/src/**"],
  ["@template/auth", "**/libs/auth/src/**"],
  ["#shared/server-api/index.ts", "**/src/**/server-api/**"],
];

async function clientBuild(specifiers: readonly string[]): Promise<string> {
  try {
    await build({
      build: { outDir: outDirectory },
      configFile: path.join(appRoot, "vite.config.ts"),
      logLevel: "silent",
      plugins: [
        {
          applyToEnvironment: (environment: Readonly<{ name: string }>): boolean =>
            environment.name === "client",
          enforce: "post",
          name: "client-bundle-probe",
          transform(code: string, id: string): string | undefined {
            const injected = specifiers
              .map((specifier) => `import ${JSON.stringify(specifier)};`)
              .join("\n");
            return id === probeModule ? `${injected}\n${code}` : undefined;
          },
        },
      ],
      root: appRoot,
    });
    return "";
  } catch (error: unknown) {
    return (
      /Denied by file pattern: (?<pattern>\S+)/u.exec(String(error))?.groups?.["pattern"] ??
      "denied"
    );
  }
}

async function bundledMarkers(): Promise<readonly string[]> {
  const entries = await readdir(outDirectory, { recursive: true });
  const sources = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".js"))
      .map(async (entry) => readFile(path.join(outDirectory, entry), "utf-8")),
  );
  return serverOnlyMarkers.filter((marker) => sources.some((source) => source.includes(marker)));
}

const unexpected: string[] = [];

const reachableDenial = await clientBuild(clientReachable);
if (reachableDenial !== "") {
  unexpected.push(`${clientReachable.join(" ")} denied by ${reachableDenial}`);
}
for (const marker of await bundledMarkers()) {
  unexpected.push(`${marker} reached the client bundle`);
}
for (const [specifier, pattern] of serverOnly) {
  // oxlint-disable-next-line no-await-in-loop
  const denial = await clientBuild([specifier]);
  if (denial !== pattern) {
    unexpected.push(`${specifier} denied by ${denial || "nothing"} instead of ${pattern}`);
  }
}
await rm(outDirectory, { force: true, recursive: true });

// oxlint-disable-next-line eslint/no-restricted-properties
process.stdout.write(
  `${JSON.stringify({
    event: "quality.client_bundle",
    inputs: clientReachable.length + serverOnly.length,
    ok: unexpected.length === 0,
    unexpected,
  })}\n`,
);
if (unexpected.length > 0) {
  process.exitCode = 1;
}
