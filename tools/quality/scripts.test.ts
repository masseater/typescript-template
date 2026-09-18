import type { UserConfig } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

import { field, workspaceManifests } from "./dependencies.ts";
import type { WorkspaceManifest } from "./dependencies.ts";
import { scriptViolations, taskViolations } from "./scripts.ts";

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

const rootTasks = runs["../../vite.config.ts"]?.tasks ?? {};

function rootTaskCommands(name: string): string[] {
  const task = rootTasks[name] ?? [];
  return [typeof task === "object" && "command" in task ? task.command : task].flat();
}

function referencedTasks(name: string, seen: Set<string>): string[] {
  if (seen.has(name)) {
    return [];
  }
  seen.add(name);
  const found: string[] = [];
  for (const entry of rootTaskCommands(name)) {
    const referenced = /^vp run (?<task>[\w:-]+)$/u.exec(entry)?.groups?.["task"];
    if (referenced !== undefined && referenced in rootTasks) {
      found.push(referenced, ...referencedTasks(referenced, seen));
    }
  }
  return found;
}

const checkSteps = referencedTasks("check", new Set())
  .filter((name: string) => name.startsWith("check:"))
  .map((name: string) => `vp run ${name}`)
  .toSorted();
const checkTaskNames = Object.keys(rootTasks)
  .filter((name) => name.startsWith("check:"))
  .map((name) => `vp run ${name}`)
  .toSorted();

const rootManifest: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

const packageManagerCommands = [
  "pnpm --filter @repo/dev run setup",
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
  "corepack pnpm --filter @repo/dev run setup",
  "env CI=true pnpm run test",
  "exec pnpm run preview",
  "vp run build && pnpm run test",
  "vp run build; npm test",
  "vp run build\nyarn test",
  "vp run build || npx knip",
];

const alchemyCommands = [
  "alchemy unsafe nuke",
  "alchemy unsafe nuke --yes",
  "alchemy destroy",
  "vp exec alchemy unsafe nuke",
  "vp dlx alchemy destroy",
  "./node_modules/.bin/alchemy unsafe nuke",
  "alchemy.cmd unsafe nuke",
  "CI=true alchemy destroy",
  "vp run deploy && alchemy unsafe nuke",
  "vp run deploy; alchemy destroy",
];

const vitePlusCommands = [
  "vp run --filter @repo/dev setup",
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

  it.for(alchemyCommands)("rejects the raw alchemy CLI: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toContain(
      `probe: alchemy の CLI は unsafe nuke と destroy でアカウント全体を消せるため直接呼べません。infra/cloudflare の src/cli.ts と src/bootstrap-state.ts から実行してください: ${command}`,
    );
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

  it.for(alchemyCommands)("rejects the raw alchemy CLI: %s", (command) => {
    expect.assertions(1);
    expect(taskViolations({ probe: { command: ["vp check", command] } })).toHaveLength(1);
  });

  it("the check task runs every check step", () => {
    expect.hasAssertions();
    expect(checkSteps).toStrictEqual(checkTaskNames);
  });

  it("all repository tasks run through Vite+", () => {
    expect.hasAssertions();
    expect(taskNames).toStrictEqual(expect.arrayContaining(["build", "check", "knip"]));
    expect(repositoryTaskViolations).toStrictEqual([]);
  });
});
