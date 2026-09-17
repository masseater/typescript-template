import { expect, test } from "vite-plus/test";
import rootManifest from "../../package.json" with { type: "json" };
import { field, workspaceManifests } from "./dependencies.ts";
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

test("all repository workspace manifests run scripts through Vite+", () => {
  const violations = [
    { file: "package.json", manifest: rootManifest },
    ...workspaceManifests,
  ].flatMap(({ file, manifest }) =>
    scriptViolations(manifest).map((violation) => `${file}: ${violation}`),
  );
  expect(violations).toEqual([]);
});

test("workspaces outside tools do not depend on tools packages", () => {
  const tools = workspaceManifests.flatMap(({ area, manifest }) => {
    const name = field(manifest, "name");
    return area === "tools" && typeof name === "string" ? [name] : [];
  });
  const consumers = workspaceManifests.filter(({ area }) => area !== "tools");
  const violations = consumers.flatMap(({ file, manifest }) => {
    const declared = ["dependencies", "devDependencies", "scripts"].flatMap((key) => {
      const value = field(manifest, key);
      return typeof value === "object" && value !== null ? Object.entries(value) : [];
    });
    return declared
      .filter(([key, value]) =>
        tools.some((tool) => key === tool || (typeof value === "string" && value.includes(tool))),
      )
      .map(([key]) => `${file}: ${key}`);
  });
  expect(violations).toEqual([]);
});
