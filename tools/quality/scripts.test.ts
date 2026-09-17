import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { scriptViolations } from "./scripts.ts";

test.for([
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
])("rejects direct package manager calls: %s", (command) => {
  expect(scriptViolations({ scripts: { probe: command } })).toEqual([
    `probe: パッケージマネージャーを直接呼ばず、script は vp run、node_modules のバイナリは vp exec、未導入のツールは vp dlx で実行してください: ${command}`,
  ]);
});

test.for([
  "vp run --filter @template/dev setup",
  "vp run -r build",
  "vp exec knip",
  "vp dlx wrangler deploy",
  "CI=true vp run test",
  "node tools/dev/src/cli.ts",
  "echo 'pnpm run test'",
  "vp run build -- --reporter pnpm",
])("allows Vite+ entry points: %s", (command) => {
  expect(scriptViolations({ scripts: { probe: command } })).toEqual([]);
});

test("rejects malformed script definitions", () => {
  expect(() => scriptViolations({ scripts: { setup: false } })).toThrow(
    "Script setup must be a string",
  );
  expect(() => scriptViolations({ scripts: [] })).toThrow("scripts must be an object");
  expect(() => scriptViolations({ scripts: { setup: "vp run 'broken" } })).toThrow(
    "unfinished shell quote",
  );
});

test("all repository workspace manifests run scripts through Vite+", async () => {
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
