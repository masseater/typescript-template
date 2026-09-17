import { describe, expect, it } from "vite-plus/test";
import { field, workspaceManifests } from "./dependencies.ts";
import { scriptViolations, taskViolations } from "./scripts.ts";
import type { UserConfig } from "vite-plus";
import type { WorkspaceManifest } from "./dependencies.ts";

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

const configs: Readonly<Record<string, Readonly<UserConfig>>> = import.meta.glob(
  ["../../vite.config.ts", "../../infra/*/vite.config.ts"],
  { eager: true, import: "default" },
);
const appRuns: Readonly<Record<string, UserConfig["run"]>> = import.meta.glob(
  "../../libs/config/src/vite.ts",
  { eager: true, import: "appRun" },
);

const runs: Readonly<Record<string, UserConfig["run"]>> = {
  ...Object.fromEntries(
    Object.keys(configs).map((file: string) => [file, configs[file]?.run] as const),
  ),
  ...appRuns,
};
const taskFiles = Object.keys(runs);
const taskNames = taskFiles.flatMap((file: string) => Object.keys(runs[file]?.tasks ?? {}));
const repositoryTaskViolations = taskFiles.flatMap((file: string) =>
  taskViolations(runs[file]?.tasks ?? {}),
);

const rootManifest: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

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

  it("all repository workspace manifests run scripts through Vite+", () => {
    expect.assertions(1);
    const manifests = [
      { area: ".", file: "package.json", manifest: rootManifest["../../package.json"] },
      ...workspaceManifests,
    ];
    const violations = manifests.flatMap(({ file, manifest }) =>
      scriptViolations(manifest).map((violation) => `${file}: ${violation}`),
    );
    expect(violations).toStrictEqual([]);
  });

  it("workspaces outside tools do not depend on tools packages", () => {
    expect.assertions(1);
    const tools = packageNames(workspaceManifests.filter(({ area }) => area === "tools"));
    const consumers = workspaceManifests.filter(({ area }) => area !== "tools");
    expect(consumers.flatMap((consumer) => toolReferences(consumer, tools))).toStrictEqual([]);
  });
});

describe("vite task conventions", () => {
  it.for(packageManagerCommands)("rejects direct package manager calls: %s", (command) => {
    expect.assertions(1);
    expect(taskViolations({ probe: { command: ["vp check", command] } })).toHaveLength(1);
  });

  it("all repository tasks run through Vite+", () => {
    expect.hasAssertions();
    expect(taskNames).toStrictEqual(expect.arrayContaining(["build", "check", "knip"]));
    expect(repositoryTaskViolations).toStrictEqual([]);
  });
});
