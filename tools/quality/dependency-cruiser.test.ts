import { describe, expect, it } from "vite-plus/test";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import configuration from "./dependency-cruiser.ts";
import { cruise } from "dependency-cruiser";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

type Fixture = Readonly<Record<string, string>>;
type Case = readonly [string, Fixture];
type Workspace = readonly [string, Readonly<Record<string, string>>];

const forbidden = configuration.forbidden ?? [];
const configuredRules = new Set<string>();
for (const rule of forbidden) {
  configuredRules.add(rule.name ?? "");
}

const workspaces: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "apps/admin": { ".": "./src/index.ts" },
  "apps/user": { ".": "./src/index.ts" },
  "apps/wiki": { ".": "./src/index.ts" },
  "libs/auth": { ".": "./src/index.ts" },
  "libs/db": {
    ".": "./src/index.ts",
    "./admin": "./src/admin.ts",
    "./local": "./src/local.ts",
    "./remote": "./src/remote-command.ts",
    "./testing": "./src/testing.ts",
  },
  "libs/ui": { ".": "./src/index.ts", "./signup": "./src/signup.tsx" },
  "tools/dev": { ".": "./src/index.ts" },
};

async function write(root: string, file: string, code: string): Promise<void> {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, code);
}

async function createWorkspace(root: string, [directory, exported]: Workspace): Promise<void> {
  const name = `@template/${directory.split("/")[1] ?? ""}`;
  await write(root, `${directory}/package.json`, JSON.stringify({ exports: exported, name }));
  await symlink(path.join(root, directory), path.join(root, "node_modules", name));
  await Promise.all(
    Object.values(exported).map(async (target) =>
      write(root, path.join(directory, target), "export const value = 1;\n"),
    ),
  );
}

async function createFixture(files: Fixture): Promise<string> {
  const prefix = path.join(tmpdir(), "template-depcruise-");
  const root = await realpath(await mkdtemp(prefix));
  await mkdir(path.join(root, "node_modules/@template"), { recursive: true });
  await Promise.all(
    Object.entries(workspaces).map(async (workspace: Workspace) =>
      createWorkspace(root, workspace),
    ),
  );
  await write(root, "node_modules/drizzle-orm/package.json", '{"name":"drizzle-orm"}');
  await write(root, "node_modules/drizzle-orm/index.js", "export const drizzle = 1;\n");
  await Promise.all(
    Object.entries(files).map(async ([file, code]: readonly [string, string]) =>
      write(root, file, code),
    ),
  );
  return root;
}

async function violatedRules(files: Fixture): Promise<readonly string[]> {
  const root = await createFixture(files);
  try {
    const { output } = await cruise(
      ["apps", "libs", "tools"],
      { ...configuration.options, baseDir: root, ruleSet: { forbidden }, validate: true },
      configuration.options?.enhancedResolveOptions,
    );
    const reported = new Set<string>();
    for (const violation of typeof output === "string" ? [] : output.summary.violations) {
      reported.add(violation.rule.name);
    }
    return [...reported].toSorted();
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

const detected: readonly Case[] = [
  ["no-unresolvable", { "apps/user/src/index.ts": 'export * from "@template/db/src/schema";\n' }],
  ["no-app-to-app", { "apps/user/src/index.ts": 'export * from "@template/admin";\n' }],
  ["no-shared-to-app", { "libs/auth/src/index.ts": 'export * from "@template/user";\n' }],
  ["no-runtime-to-tools", { "libs/auth/src/index.ts": 'export * from "@template/dev";\n' }],
  ["no-package-escape", { "libs/auth/src/index.ts": 'export * from "../../db/src/index.ts";\n' }],
  [
    "no-database-admin-outside-admin",
    { "apps/user/src/index.ts": 'export * from "@template/db/admin";\n' },
  ],
  ["no-database-admin-outside-admin", { "libs/db/src/index.ts": 'export * from "./admin.ts";\n' }],
  [
    "no-database-operations-outside-tooling",
    { "apps/admin/src/index.ts": 'export * from "@template/db/remote";\n' },
  ],
  [
    "no-database-testing-outside-tests",
    { "libs/auth/src/index.ts": 'export * from "@template/db/testing";\n' },
  ],
  ["no-raw-database-driver", { "libs/auth/src/index.ts": 'export * from "drizzle-orm";\n' }],
  [
    "no-production-to-test",
    {
      "libs/auth/src/helper.test.ts": "export const helper = 1;\n",
      "libs/auth/src/index.ts": 'export * from "./helper.test.ts";\n',
    },
  ],
  [
    "no-signup-outside-user",
    { "apps/admin/src/index.ts": 'export * from "@template/ui/signup";\n' },
  ],
  ["no-wiki-to-database", { "apps/wiki/src/index.ts": 'export * from "@template/db";\n' }],
  [
    "no-browser-to-server",
    {
      "libs/ui/src/bridge.ts": 'export * from "@template/db";\n',
      "libs/ui/src/index.ts": 'export * from "./bridge.ts";\n',
    },
  ],
];

const accepted: readonly Case[] = [
  ["the boundaries the repository already keeps", {}],
  [
    "the admin app reads the administrative operations",
    { "apps/admin/src/index.ts": 'export * from "@template/db/admin";\n' },
  ],
  [
    "operational tooling runs the remote database commands",
    { "tools/dev/src/index.ts": 'export * from "@template/db/remote";\n' },
  ],
  [
    "a test builds its own database",
    { "libs/auth/src/session.test.ts": 'export * from "@template/db/testing";\n' },
  ],
  [
    "the database package owns the driver",
    { "libs/db/src/index.ts": 'export * from "drizzle-orm";\n' },
  ],
  [
    "wiki keeps the local database definition",
    { "apps/wiki/src/index.ts": 'export * from "@template/db/local";\n' },
  ],
  [
    "the user app owns the signup screen",
    { "apps/user/src/index.ts": 'export * from "@template/ui/signup";\n' },
  ],
  [
    "the browser package reads the shared parts",
    { "apps/user/src/index.ts": 'export * from "@template/ui";\n' },
  ],
];

describe("dependency-cruiser rules on package boundaries", () => {
  it("every rule has a case that reports it", () => {
    expect.hasAssertions();
    expect([...new Set(detected.map(([rule]) => rule))].toSorted()).toStrictEqual(
      [...configuredRules].toSorted(),
    );
  });

  it.for(detected)("reports %s", async ([rule, files]) => {
    expect.hasAssertions();
    await expect(violatedRules(files)).resolves.toContain(rule);
  });

  it.for(accepted)("accepts %s", async ([, files]) => {
    expect.hasAssertions();
    await expect(violatedRules(files)).resolves.toStrictEqual([]);
  });
});
