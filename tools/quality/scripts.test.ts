import { describe, expect, it } from "vite-plus/test";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, readdir } from "node:fs/promises";
import { scriptViolations } from "./scripts.ts";

interface WorkspaceManifest {
  readonly manifest: unknown;
  readonly name: string;
}

const root = new URL("../../", import.meta.url);

function field(manifest: unknown, key: string): unknown {
  return typeof manifest === "object" && manifest !== null
    ? Object.getOwnPropertyDescriptor(manifest, key)?.value
    : undefined;
}

async function workspaceDirectories(areas: readonly string[]): Promise<string[]> {
  const directories = await Promise.all(
    areas.map(async (area) => {
      const entries = await readdir(new URL(`${area}/`, root), { withFileTypes: true });
      return entries
        .filter((entry: Readonly<{ isDirectory: () => boolean }>) => entry.isDirectory())
        .map((entry: Readonly<{ name: string }>) => `${area}/${entry.name}`);
    }),
  );
  return directories.flat();
}

async function manifestsIn(directories: readonly string[]): Promise<WorkspaceManifest[]> {
  const found = await Promise.all(
    directories.map(async (directory): Promise<WorkspaceManifest[]> => {
      const files = await readdir(new URL(`${directory}/`, root));
      if (!files.includes("package.json")) {
        return [];
      }
      const location = new URL(`${directory}/package.json`, root);
      const name = location.href.slice(root.href.length);
      const manifest: unknown = JSON.parse(await readFile(location, "utf-8"));
      return [{ manifest, name }];
    }),
  );
  return found.flat();
}

function packageNames(manifests: readonly WorkspaceManifest[]): string[] {
  return manifests.flatMap(({ manifest }) => {
    const name = field(manifest, "name");
    return typeof name === "string" ? [name] : [];
  });
}

function toolReferences({ manifest, name }: WorkspaceManifest, tools: readonly string[]): string[] {
  const declared = ["dependencies", "devDependencies", "scripts"].flatMap((key) => {
    const value = field(manifest, key);
    return typeof value === "object" && value !== null ? Object.entries(value) : [];
  });
  return declared
    .filter(([key, value]: readonly [string, unknown]) =>
      tools.some((tool) => key === tool || (typeof value === "string" && value.includes(tool))),
    )
    .map(([key]: readonly [string, unknown]) => `${name}: ${key}`);
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
    const directories = await workspaceDirectories(["apps", "libs", "infra", "tools"]);
    const manifests = await manifestsIn([".", ...directories]);
    const violations = manifests.flatMap(({ manifest, name }) =>
      scriptViolations(manifest).map((violation) => `${name}: ${violation}`),
    );
    expect(violations).toStrictEqual([]);
  });

  it("workspaces outside tools do not depend on tools packages", async () => {
    expect.assertions(1);
    const tools = packageNames(await manifestsIn(await workspaceDirectories(["tools"])));
    const consumers = await manifestsIn(await workspaceDirectories(["apps", "libs", "infra"]));
    expect(consumers.flatMap((consumer) => toolReferences(consumer, tools))).toStrictEqual([]);
  });
});
