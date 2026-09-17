import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scriptViolations } from "./scripts.ts";

interface WorkspaceManifest {
  readonly manifest: unknown;
  readonly name: string;
}

const root = fileURLToPath(new URL("../../", import.meta.url));

function field(manifest: unknown, key: string): unknown {
  return typeof manifest === "object" && manifest !== null
    ? Object.getOwnPropertyDescriptor(manifest, key)?.value
    : undefined;
}

async function workspaceDirectories(areas: readonly string[]): Promise<string[]> {
  const directories = await Promise.all(
    areas.map(async (area) => {
      const entries = await readdir(path.join(root, area), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(area, entry.name));
    }),
  );
  return directories.flat();
}

async function manifestsIn(directories: readonly string[]): Promise<WorkspaceManifest[]> {
  const found = await Promise.all(
    directories.map(async (directory): Promise<WorkspaceManifest[]> => {
      const files = await readdir(path.join(root, directory));
      if (!files.includes("package.json")) {
        return [];
      }
      const name = path.join(directory, "package.json");
      const manifest: unknown = JSON.parse(await readFile(path.join(root, name), "utf-8"));
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
    .filter(([key, value]) =>
      tools.some((tool) => key === tool || (typeof value === "string" && value.includes(tool))),
    )
    .map(([key]) => `${name}: ${key}`);
}

const ambiguousCommands = [
  "pnpm --filter @template/dev setup",
  "pnpm --filter @template/local config",
  "pnpm --filter @template/user build",
  "pnpm --filter=@template/dev setup",
  "pnpm --filter-prod=@template/dev setup",
  "pnpm -F @template/dev setup",
  "pnpm -F@template/dev setup",
  'pnpm --filter "@template/dev" setup',
  "pnpm --filter '@template/*' setup",
  "pnpm --filter @template/dev --if-present setup",
  "pnpm --dir . --filter @template/dev setup",
  "corepack pnpm --filter @template/dev setup",
  "env CI=true pnpm --filter @template/dev setup",
  "pnpm --filter @template/dev run start && pnpm --filter @template/local config",
  "pnpm --filter @template/dev setup -- run",
  "pnpm --filter @template/dev setup; pnpm run test",
  "pnpm --filter @template/dev setup\npnpm run test",
  "pnpm --filter @template/dev setup || pnpm --filter @template/dev run start",
];

const explicitCommands = [
  "pnpm --filter @template/dev run setup",
  "pnpm --filter @template/local run config",
  "pnpm --filter=@template/user run build",
  "pnpm -F @template/dev run setup",
  "pnpm --filter @template/dev --resume-from @template/dev run setup",
  "pnpm --filter '@template/*' --if-present run build",
  "pnpm --filter @template/dev run setup && pnpm --filter @template/local run config",
  "pnpm --filter @template/dev run setup -- --filter anything",
  "pnpm run test",
  "pnpm -r --if-present build",
  "node tools/dev/src/cli.ts",
  "echo 'pnpm --filter @template/dev setup'",
];

describe("workspace script conventions", () => {
  it.for(ambiguousCommands)("rejects pnpm builtin ambiguity: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toStrictEqual([
      `probe: pnpm --filter に続く workspace script は必ず run を明示してください: ${command}`,
    ]);
  });

  it.for(explicitCommands)("allows explicit workspace script execution: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toStrictEqual([]);
  });

  it("rejects malformed script definitions", () => {
    expect.hasAssertions();
    expect(() => scriptViolations({ scripts: { setup: false } })).toThrow(
      "Script setup must be a string",
    );
    expect(() => scriptViolations({ scripts: [] })).toThrow("scripts must be an object");
    expect(() => scriptViolations({ scripts: { setup: "pnpm --filter 'broken" } })).toThrow(
      "unfinished shell quote",
    );
  });

  it("all repository workspace manifests use explicit run after pnpm filters", async () => {
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
