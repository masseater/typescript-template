import { Effect, FileSystem, Path, Schema, type PlatformError, type Scope } from "effect";

type Fixture = Readonly<Record<string, string>>;

const workspaces: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "apps/service-admin": { ".": "./src/index.ts" },
  "apps/service-member": { ".": "./src/index.ts" },
  "apps/internal-dashboard": { ".": "./src/index.ts" },
  "apps/internal-wiki": { ".": "./src/index.ts" },
  "libs/auth": { ".": "./src/features/auth/index.ts" },
  "libs/config": {
    ".": "./src/features/config/index.ts",
    "./storage": "./src/features/config/storage.ts",
  },
  "libs/db": {
    ".": "./src/features/db/index.ts",
    "./admin": "./src/features/db/admin.ts",
    "./bootstrap": "./src/features/db/bootstrap-statement.ts",
    "./local": "./src/features/db/local.ts",
    "./remote": "./src/features/db/remote-command.ts",
    "./testing": "./src/features/db/testing.ts",
  },
  "libs/observability": {
    ".": "./src/features/observability/index.ts",
    "./testing": "./src/features/observability/testing.ts",
  },
  "libs/runtime": {
    ".": "./src/features/runtime/index.ts",
    "./contracts": "./src/features/runtime/contracts.ts",
    "./security": "./src/features/runtime/security.ts",
    "./storage": "./src/features/runtime/storage.ts",
  },
  "libs/auth-ui": { ".": "./src/features/auth-ui/index.ts" },
  "libs/ui": { ".": "./src/features/ui/index.ts" },
  "infra/cloudflare": {
    "./application": "./src/features/cloudflare/app.ts",
    "./core-program": "./src/features/cloudflare/core-program.ts",
    "./deployment": "./src/features/cloudflare/deployment.ts",
    "./monitor": "./src/features/cloudflare/monitor.ts",
    "./stacks": "./src/features/cloudflare/stacks.ts",
  },
  "tools/dev": { ".": "./src/features/dev/index.ts" },
};
const installedPackages = ["drizzle-orm", "miniflare", "msw"];

type FixtureBuild<Built> = Effect.Effect<
  Built,
  PlatformError.PlatformError | Schema.SchemaError,
  FileSystem.FileSystem | Path.Path
>;

const write = (root: string, file: string, code: string): FixtureBuild<void> =>
  Effect.gen(function* write() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const target = paths.join(root, file);
    yield* filesystem.makeDirectory(paths.dirname(target), { recursive: true });
    yield* filesystem.writeFileString(target, code);
  });

type Workspace = readonly [string, Readonly<Record<string, string>>];

const developmentDependencies: Readonly<Record<string, readonly string[]>> = { "libs/ui": ["msw"] };

const packageNames: Readonly<Record<string, string>> = {
  "infra/cloudflare": "@repo/infra-cloudflare",
};

const createWorkspace = (root: string, [directory, exported]: Workspace): FixtureBuild<void> =>
  Effect.gen(function* createWorkspace() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const name = packageNames[directory] ?? `@repo/${directory.split("/")[1] ?? ""}`;
    const devDependencies = Object.fromEntries(
      (developmentDependencies[directory] ?? []).map((dependency) => [dependency, "*"]),
    );
    yield* write(
      root,
      `${directory}/package.json`,
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        devDependencies,
        exports: exported,
        name,
      }),
    );
    yield* filesystem.symlink(paths.join(root, directory), paths.join(root, "node_modules", name));
    yield* Effect.forEach(
      Object.values(exported),
      (target) => write(root, paths.join(directory, target), "export const value = 1;\n"),
      { concurrency: "unbounded", discard: true },
    );
  });

const createPackage = (root: string, name: string): FixtureBuild<void> =>
  Effect.gen(function* createPackage() {
    yield* write(
      root,
      `node_modules/${name}/package.json`,
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name }),
    );
    yield* write(root, `node_modules/${name}/index.js`, "export const value = 1;\n");
  });

const createFixture = (
  files: Fixture,
): Effect.Effect<
  string,
  PlatformError.PlatformError | Schema.SchemaError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> =>
  Effect.gen(function* createFixture() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const root = yield* filesystem.realPath(
      yield* filesystem.makeTempDirectoryScoped({ prefix: "template-depcruise-" }),
    );
    yield* filesystem.makeDirectory(paths.join(root, "node_modules/@repo"), { recursive: true });
    yield* Effect.forEach(
      Object.entries(workspaces),
      (workspace: Workspace) => createWorkspace(root, workspace),
      { concurrency: "unbounded", discard: true },
    );
    yield* Effect.forEach(installedPackages, (name) => createPackage(root, name), {
      concurrency: "unbounded",
      discard: true,
    });
    yield* Effect.forEach(
      Object.entries(files),
      ([file, code]: readonly [string, string]) => write(root, file, code),
      { concurrency: "unbounded", discard: true },
    );
    return root;
  });

export { createFixture };
export type { Fixture };
