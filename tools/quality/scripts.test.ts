import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { scriptViolations } from "./scripts.ts";

test.for([
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
])("rejects pnpm builtin ambiguity: %s", (command) => {
  expect(scriptViolations({ scripts: { probe: command } })).toEqual([
    `probe: pnpm --filter に続く workspace script は必ず run を明示してください: ${command}`,
  ]);
});

test.for([
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
])("allows explicit workspace script execution: %s", (command) => {
  expect(scriptViolations({ scripts: { probe: command } })).toEqual([]);
});

test("rejects malformed script definitions", () => {
  expect(() => scriptViolations({ scripts: { setup: false } })).toThrow(
    "Script setup must be a string",
  );
  expect(() => scriptViolations({ scripts: [] })).toThrow("scripts must be an object");
  expect(() => scriptViolations({ scripts: { setup: "pnpm --filter 'broken" } })).toThrow(
    "unfinished shell quote",
  );
});

test("all repository workspace manifests use explicit run after pnpm filters", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directories = await Promise.all(
    ["apps", "libs", "infra", "tools"].map(async (area) => {
      const entries = await readdir(path.join(root, area), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(area, entry.name));
    }),
  );
  const violations = await Promise.all(
    [".", ...directories.flat()].map(async (directory) => {
      const name = path.join(directory, "package.json");
      const files = await readdir(path.join(root, directory));
      if (!files.includes("package.json")) return [];
      const manifest: unknown = JSON.parse(await readFile(path.join(root, name), "utf8"));
      return scriptViolations(manifest).map((violation) => `${name}: ${violation}`);
    }),
  );
  expect(violations.flat()).toEqual([]);
});

test("workspaces outside tools do not depend on tools packages", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const manifests = async (area: string) => {
    const entries = await readdir(path.join(root, area), { withFileTypes: true });
    const found = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const name = path.join(area, entry.name, "package.json");
          const text = await readFile(path.join(root, name), "utf8").catch(() => undefined);
          const manifest: unknown = text === undefined ? undefined : JSON.parse(text);
          return manifest === undefined ? [] : [{ name, manifest }];
        }),
    );
    return found.flat();
  };
  const tools = (await manifests("tools")).flatMap(({ manifest }) => {
    const name = field(manifest, "name");
    return typeof name === "string" ? [name] : [];
  });
  const consumers = (await Promise.all(["apps", "libs", "infra"].map(manifests))).flat();
  const violations = consumers.flatMap(({ name, manifest }) => {
    const declared = ["dependencies", "devDependencies", "scripts"].flatMap((key) => {
      const value = field(manifest, key);
      return typeof value === "object" && value !== null ? Object.entries(value) : [];
    });
    return declared
      .filter(([key, value]) =>
        tools.some((tool) => key === tool || (typeof value === "string" && value.includes(tool))),
      )
      .map(([key]) => `${name}: ${key}`);
  });
  expect(violations).toEqual([]);
});

function field(manifest: unknown, key: string): unknown {
  return typeof manifest === "object" && manifest !== null
    ? Object.getOwnPropertyDescriptor(manifest, key)?.value
    : undefined;
}
