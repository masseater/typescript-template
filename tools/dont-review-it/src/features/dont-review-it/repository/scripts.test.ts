import { describe, expect, it } from "vite-plus/test";

import { field, workspaceManifests } from "./dependencies-test-fixture.ts";
import { scriptViolations, taskViolations } from "./scripts-test-fixture.ts";
import { configuredDirectories, workspaceTasks } from "./tasks-test-fixture.ts";

import type { WorkspaceManifest } from "./dependencies-test-fixture.ts";

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

const repositoryTaskViolations = configuredDirectories.flatMap((directory) =>
  taskViolations(workspaceTasks[directory] ?? {}).map((violation) => `${directory}: ${violation}`),
);

const rootManifest: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../../../package.json",
  {
    eager: true,
    import: "default",
  },
);

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

const nodeFileCommands = [
  "node tools/dev/src/features/dev/cli.ts",
  "node src/cli.ts setup",
  "./node_modules/.bin/node src/cli.ts",
  "CI=true node src/inspect.ts",
  "env NODE_ENV=production node src/cli.ts",
  "vp check && node src/cli.ts",
];

const vitePlusCommands = [
  "vp run --filter @repo/dev setup",
  "vp run -r build",
  "vp exec knip",
  "vp dlx wrangler deploy",
  "CI=true vp run test",
  "node --version",
  "echo 'pnpm run test'",
  "vp run build -- --reporter pnpm",
];

describe("workspace script conventions", () => {
  it.for(packageManagerCommands)("rejects direct package manager calls: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toContain(
      `probe: パッケージマネージャーを直接呼ばず、script は vp run、node_modules のバイナリは vp exec、未導入のツールは vp dlx で実行してください: ${command}`,
    );
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
      { area: ".", file: "package.json", manifest: rootManifest["../../../../../../package.json"] },
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

const composedCommands = [
  "vp config --no-agent && effect-tsgo patch --typescript --oxlint",
  "export NODE_OPTIONS=--throw-deprecation; vp config --no-agent",
  "vp run build || vp run fallback",
  "vp run build | tee build.log",
  "vp run build\nvp run test",
];

const shellWrappedCommands = [
  "bash -c 'export NODE_OPTIONS=--throw-deprecation; vp config --no-agent && vp run --filter @repo/dev prepare-browser && effect-tsgo patch --typescript --oxlint'",
  "sh -c 'vp run build'",
  "bash -lc 'vp run build'",
  "/bin/bash -c 'vp run build'",
  "env CI=true sh -c 'vp run build'",
];

const outsideWorkspaceCommands = [
  "../../tools/dev/src/features/dev/dev-start.ts",
  "../dev/cli.ts setup",
  "CI=true ../../tools/dev/src/features/dev/dev-start.ts",
];

const singleCommands = [
  "NODE_OPTIONS=--throw-deprecation vp run prepare:repository",
  "dev-start",
  "./src/features/dev/cli.ts setup",
  "echo 'a && b; c'",
];

describe("commands that compose several calls", () => {
  it.for(composedCommands)("rejects a chained script: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toContain(
      `probe: &&・;・| や改行で複数のコマンドをつながず、1 つのコマンド呼び出しにしてください。工程が複数あるなら vite.config.ts のタスクに分けて dependsOn でつないでください: ${command}`,
    );
  });

  it.for(composedCommands)("rejects a chained task: %s", (command) => {
    expect.assertions(1);
    expect(taskViolations({ probe: { command } })).toHaveLength(1);
  });

  it.for(shellWrappedCommands)("rejects a command wrapped in a shell: %s", (command) => {
    expect.assertions(2);
    const violation = `probe: bash -c や sh -c でコマンドを包まず、1 つのコマンド呼び出しにしてください。中身の検査が効かなくなります: ${command}`;
    expect(scriptViolations({ scripts: { probe: command } })).toContain(violation);
    expect(taskViolations({ probe: { command } })).toContain(violation);
  });

  it.for(outsideWorkspaceCommands)(
    "rejects launching a file outside the workspace: %s",
    (command) => {
      expect.assertions(2);
      const violation = `probe: workspace の外のファイルを相対パスで起動せず、そのファイルを持つパッケージの bin を呼んでください: ${command}`;
      expect(taskViolations({ probe: { command } })).toContain(violation);
      expect(scriptViolations({ scripts: { probe: command } })).toContain(violation);
    },
  );

  it.for(singleCommands)("allows a single call: %s", (command) => {
    expect.assertions(2);
    expect(scriptViolations({ scripts: { probe: command } })).toStrictEqual([]);
    expect(taskViolations({ probe: { command } })).toStrictEqual([]);
  });
});

describe("workspace scripts that run a file with node", () => {
  it.for(nodeFileCommands)("rejects running a file with node: %s", (command) => {
    expect.assertions(1);
    expect(scriptViolations({ scripts: { probe: command } })).toContain(
      `probe: node でファイルを直接実行せず、パッケージの bin か vp run で実行してください: ${command}`,
    );
  });
});

describe("vite task conventions", () => {
  it.for(nodeFileCommands)("rejects running a file with node from tasks: %s", (command) => {
    expect.assertions(1);
    expect(taskViolations({ probe: { command } })).toContain(
      `probe: node でファイルを直接実行せず、パッケージの bin か vp run で実行してください: ${command}`,
    );
  });

  it.for(packageManagerCommands)("rejects direct package manager calls: %s", (command) => {
    expect.assertions(1);
    expect(taskViolations({ probe: { command: ["vp check", command] } })).toContain(
      `probe: パッケージマネージャーを直接呼ばず、script は vp run、node_modules のバイナリは vp exec、未導入のツールは vp dlx で実行してください: ${command}`,
    );
  });

  it.for(alchemyCommands)("rejects the raw alchemy CLI: %s", (command) => {
    expect.assertions(1);
    expect(taskViolations({ probe: { command: ["vp check", command] } })).toContain(
      `probe: alchemy の CLI は unsafe nuke と destroy でアカウント全体を消せるため直接呼べません。infra/cloudflare の src/cli.ts と src/bootstrap-state.ts から実行してください: ${command}`,
    );
  });

  it("all repository tasks run through Vite+", () => {
    expect.hasAssertions();
    expect(configuredDirectories).toContain(".");
    expect(repositoryTaskViolations).toStrictEqual([]);
  });
});
