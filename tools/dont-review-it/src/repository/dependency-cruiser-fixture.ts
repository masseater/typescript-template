import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type Fixture = Readonly<Record<string, string>>;

const workspaces: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "apps/service-admin": { ".": "./src/index.ts" },
  "apps/service-member": { ".": "./src/index.ts" },
  "apps/internal-dashboard": { ".": "./src/index.ts" },
  "libs/auth": { ".": "./src/index.ts" },
  "libs/config": { ".": "./src/index.ts", "./storage": "./src/storage.ts" },
  "libs/db": {
    ".": "./src/index.ts",
    "./admin": "./src/admin.ts",
    "./bootstrap": "./src/bootstrap-statement.ts",
    "./inquiry-staff": "./src/inquiry-staff.ts",
    "./local": "./src/local.ts",
    "./remote": "./src/remote-command.ts",
    "./staff": "./src/staff.ts",
    "./testing": "./src/testing.ts",
  },
  "libs/observability": { ".": "./src/index.ts", "./testing": "./src/testing.ts" },
  "libs/runtime": {
    ".": "./src/index.ts",
    "./contracts": "./src/contracts.ts",
    "./security": "./src/security.ts",
    "./storage": "./src/storage.ts",
  },
  "libs/auth-ui": { ".": "./src/index.ts" },
  "libs/ui": { ".": "./src/index.ts" },
  "infra/cloudflare": {
    "./application": "./src/app.ts",
    "./core-program": "./src/core-program.ts",
    "./deployment": "./src/deployment.ts",
    "./stacks": "./src/stacks.ts",
  },
  "tools/dev": { ".": "./src/index.ts" },
};
const installedPackages = ["drizzle-orm", "miniflare", "msw"];

const write = async (root: string, file: string, code: string): Promise<void> => {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, code);
};

type Workspace = readonly [string, Readonly<Record<string, string>>];

const developmentDependencies: Readonly<Record<string, readonly string[]>> = { "libs/ui": ["msw"] };

const packageNames: Readonly<Record<string, string>> = {
  "infra/cloudflare": "@repo/infra-cloudflare",
};

const createWorkspace = async (root: string, [directory, exported]: Workspace): Promise<void> => {
  const name = packageNames[directory] ?? `@repo/${directory.split("/")[1] ?? ""}`;
  const devDependencies = Object.fromEntries(
    (developmentDependencies[directory] ?? []).map((dependency) => [dependency, "*"]),
  );
  await write(
    root,
    `${directory}/package.json`,
    JSON.stringify({ devDependencies, exports: exported, name }),
  );
  await symlink(path.join(root, directory), path.join(root, "node_modules", name));
  await Promise.all(
    Object.values(exported).map(async (target) =>
      write(root, path.join(directory, target), "export const value = 1;\n"),
    ),
  );
};

const createPackage = async (root: string, name: string): Promise<void> => {
  await write(root, `node_modules/${name}/package.json`, JSON.stringify({ name }));
  await write(root, `node_modules/${name}/index.js`, "export const value = 1;\n");
};

const createFixture = async (files: Fixture): Promise<string> => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "template-depcruise-")));
  await mkdir(path.join(root, "node_modules/@repo"), { recursive: true });
  await Promise.all(
    Object.entries(workspaces).map(async (workspace: Workspace) =>
      createWorkspace(root, workspace),
    ),
  );
  await Promise.all(installedPackages.map(async (name) => createPackage(root, name)));
  await Promise.all(
    Object.entries(files).map(async ([file, code]: readonly [string, string]) =>
      write(root, file, code),
    ),
  );
  return root;
};

export { createFixture };
export type { Fixture };
