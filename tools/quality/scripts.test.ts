import { describe, expect, it } from "vite-plus/test";
import { field, readWorkspaceManifests } from "./dependencies.ts";
import type { WorkspaceManifest } from "./dependencies.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
import { scriptViolations } from "./scripts.ts";

const root = new URL("../../", import.meta.url).href;

async function rootManifest(): Promise<WorkspaceManifest> {
  const manifest: unknown = JSON.parse(await readFile(new URL("package.json", root), "utf-8"));
  return { area: ".", file: "package.json", manifest };
}

function packageNames(manifests: readonly WorkspaceManifest[]): string[] {
  return manifests.flatMap(({ manifest }) => {
    const name = field(manifest, "name");
    return typeof name === "string" ? [name] : [];
  });
}

function toolReferences({ file, manifest }: WorkspaceManifest, tools: readonly string[]): string[] {
  const declared = ["dependencies", "devDependencies", "scripts"].flatMap((key) => {
    const value = field(manifest, key);
    return typeof value === "object" && value !== null ? Object.entries(value) : [];
  });
  return declared
    .filter(([key, value]: readonly [string, unknown]) =>
      tools.some((tool) => key === tool || (typeof value === "string" && value.includes(tool))),
    )
    .map(([key]: readonly [string, unknown]) => `${file}: ${key}`);
}

const packageManagerCommands = [
  "pnpm --filter @template/dev run setup",
  "pnpm -r --if-present build",
  "pnpm run test",
  "pnpm check",
  "pnpm exec knip",
  "pnpm dlx wrangler deploy",
  "pnpx wrangler deploy",
  "npm run build",
  "npx knip",
  "yarn build",
  "bunx vp build",
  "./node_modules/.bin/pnpm run build",
  "pnpm.cmd run build",
  "corepack pnpm --filter @template/dev run setup",
  "env CI=true pnpm run test",
  "exec pnpm run preview",
  "vp run build && pnpm run test",
  "vp run build; npm test",
  "vp run build\nyarn test",
  "vp run build || npx knip",
];

const vitePlusCommands = [
  "vp run --filter @template/dev setup",
  "vp run -r build",
  "vp exec knip",
  "vp dlx wrangler deploy",
  "CI=true vp run test",
  "node tools/dev/src/cli.ts",
  "echo 'pnpm run test'",
  "vp run build -- --reporter pnpm",
];

describe("workspace script conventions", () => {
  it.for(packageManagerCommands)("rejects direct package manager calls: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toStrictEqual([
      `probe: パッケージマネージャーを直接呼ばず、script は vp run、node_modules のバイナリは vp exec、未導入のツールは vp dlx で実行してください: ${command}`,
    ]);
  });

  it.for(vitePlusCommands)("allows Vite+ entry points: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toStrictEqual([]);
  });

  it("rejects malformed script definitions", () => {
    expect.hasAssertions();
    expect(() => scriptViolations({ scripts: { setup: false } })).toThrow(
      "Script setup must be a string",
    );
    expect(() => scriptViolations({ scripts: [] })).toThrow("scripts must be an object");
    expect(() => scriptViolations({ scripts: { setup: "vp run 'broken" } })).toThrow(
      "unfinished shell quote",
    );
  });

  it("all repository workspace manifests run scripts through Vite+", async () => {
    expect.assertions(1);
    const manifests = [await rootManifest(), ...(await readWorkspaceManifests(root))];
    const violations = manifests.flatMap(({ file, manifest }) =>
      scriptViolations(manifest).map((violation) => `${file}: ${violation}`),
    );
    expect(violations).toStrictEqual([]);
  });

  it("workspaces outside tools do not depend on tools packages", async () => {
    expect.assertions(1);
    const workspaces = await readWorkspaceManifests(root);
    const tools = packageNames(workspaces.filter(({ area }) => area === "tools"));
    const consumers = workspaces.filter(({ area }) => area !== "tools");
    expect(consumers.flatMap((consumer) => toolReferences(consumer, tools))).toStrictEqual([]);
  });
});
