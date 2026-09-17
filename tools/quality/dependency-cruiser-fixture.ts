// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

type Fixture = Readonly<Record<string, string>>;
type Workspace = readonly [string, Readonly<Record<string, string>>];

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
  "libs/runtime": { ".": "./src/index.ts", "./contracts": "./src/contracts.ts" },
  "libs/ui": { ".": "./src/index.ts", "./signup": "./src/signup.tsx" },
  "tools/dev": { ".": "./src/index.ts" },
};
const developmentDependencies: Readonly<Record<string, readonly string[]>> = { "libs/ui": ["msw"] };
const installedPackages = ["drizzle-orm", "msw"];

async function write(root: string, file: string, code: string): Promise<void> {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, code);
}

async function createWorkspace(root: string, [directory, exported]: Workspace): Promise<void> {
  const name = `@template/${directory.split("/")[1] ?? ""}`;
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
}

async function createPackage(root: string, name: string): Promise<void> {
  await write(root, `node_modules/${name}/package.json`, JSON.stringify({ name }));
  await write(root, `node_modules/${name}/index.js`, "export const value = 1;\n");
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
  await Promise.all(installedPackages.map(async (name) => createPackage(root, name)));
  await Promise.all(
    Object.entries(files).map(async ([file, code]: readonly [string, string]) =>
      write(root, file, code),
    ),
  );
  return root;
}

export { createFixture };
export type { Fixture };
