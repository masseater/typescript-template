import { assert, it } from "@effect/vitest";
// oxlint-disable-next-line import/no-nodejs-modules
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import type { Application } from "@template/config";
import type { ArtifactFailure } from "./artifact-io.ts";
import { Effect } from "effect";
import type { Scope } from "effect";
import { loadArtifacts } from "./artifacts.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

interface UserBuild {
  readonly client: string;
  readonly root: string;
  readonly server: string;
}

async function createTemporaryRoot(): Promise<string> {
  const temporary = await mkdtemp(path.join(tmpdir(), "template-artifacts-"));
  return realpath(temporary);
}

const temporaryRoot = Effect.acquireRelease(Effect.promise(createTemporaryRoot), (root) =>
  Effect.promise(async () => rm(root, { force: true, recursive: true })),
);

function run<Value>(operation: () => Promise<Value>): Effect.Effect<Value> {
  return Effect.promise(operation);
}

async function writeFiles(
  directory: string,
  contents: Readonly<Record<string, string>>,
): Promise<void> {
  await Promise.all(
    Object.entries(contents).map(async ([name, content]: readonly [string, string]) => {
      const filename = path.join(directory, name);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, content);
    }),
  );
}

async function writeUserBuild(root: string): Promise<UserBuild> {
  const client = path.join(root, "apps/user/dist/client");
  const server = path.join(root, "apps/user/dist/server");
  await writeFiles(client, {
    "app.js": "export const publicValue = 1;",
    "app.js.map": "private source map",
    "styles.css": "body{color:red}",
  });
  await writeFiles(server, {
    ".dev.vars": "AUTH_SECRET=private",
    ".env.production": "AUTH_SECRET=private",
    ".vite/manifest.json": "{}",
    "chunks/handler.js": "export default {};",
    "index.js": 'export { default } from "./chunks/handler.js";',
    "styles.css": "body{color:red}",
  });
  return { client, root, server };
}

const userBuild: Effect.Effect<UserBuild, never, Scope.Scope> = temporaryRoot.pipe(
  Effect.flatMap((root) => run(async () => writeUserBuild(root))),
);

function failureCode(
  root: string,
  target: Application,
): Effect.Effect<ArtifactFailure["code"], Effect.Success<ReturnType<typeof loadArtifacts>>> {
  return loadArtifacts(root, target).pipe(
    Effect.flip,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((failure) => failure.code),
  );
}

it.effect(
  "uploads server chunks with their source maps but excludes private client source maps",
  () =>
    Effect.gen(function* program() {
      const { client, root, server } = yield* userBuild;
      yield* run(async () => writeFiles(server, { "index.js.map": "{}", "orphan.js.map": "{}" }));
      const artifacts = yield* loadArtifacts(root, "user");
      assert.deepStrictEqual(
        artifacts.modules.map((module) => module.name),
        ["chunks/handler.js", "index.js", "index.js.map"],
      );
      assert.deepStrictEqual(
        (yield* run(async () => readdir(path.dirname(artifacts.mainModule)))).toSorted(),
        ["chunks", "index.js", "index.js.map"],
      );
      assert.match(artifacts.release, /^[0-9a-f]{16}$/u);
      assert.deepStrictEqual(yield* run(async () => readdir(artifacts.clientDirectory)), [
        "app.js",
        "styles.css",
      ]);
      assert.strictEqual(
        yield* run(async () => readFile(path.join(client, "app.js.map"), "utf-8")),
        "private source map",
      );
    }).pipe(Effect.scoped),
);

it.effect("reuses the staging directory for unchanged client content", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const first = yield* loadArtifacts(root, "user");
    const second = yield* loadArtifacts(root, "user");
    assert.strictEqual(second.clientDirectory, first.clientDirectory);
  }).pipe(Effect.scoped),
);

it.effect("refuses server CSS that differs from its public asset", () =>
  Effect.gen(function* program() {
    const { root, server } = yield* userBuild;
    yield* run(async () => writeFile(path.join(server, "styles.css"), "body{color:blue}"));
    assert.strictEqual(yield* failureCode(root, "user"), "server_css_without_public_asset");
  }).pipe(Effect.scoped),
);

it.effect("never writes through a link placed in the staging directory", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const artifacts = yield* loadArtifacts(root, "user");
    const protectedFile = path.join(root, "protected.txt");
    yield* run(async () => {
      await writeFile(protectedFile, "do not overwrite");
      await unlink(path.join(artifacts.clientDirectory, "app.js"));
      await symlink(protectedFile, path.join(artifacts.clientDirectory, "app.js"));
    });
    assert.strictEqual(yield* failureCode(root, "user"), "artifact_staging_link_forbidden");
    assert.strictEqual(
      yield* run(async () => readFile(protectedFile, "utf-8")),
      "do not overwrite",
    );
  }).pipe(Effect.scoped),
);

it.effect("stages changed client content in a new directory", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    const first = yield* loadArtifacts(root, "user");
    yield* run(async () => writeFile(path.join(client, "app.js"), "export const publicValue = 2;"));
    const second = yield* loadArtifacts(root, "user");
    assert.notStrictEqual(second.clientDirectory, first.clientDirectory);
    assert.notStrictEqual(second.release, first.release);
  }).pipe(Effect.scoped),
);

it.effect("derives the release from code and client content but not from source maps", () =>
  Effect.gen(function* program() {
    const { root, server } = yield* userBuild;
    yield* run(async () => writeFiles(server, { "index.js.map": "{}" }));
    const first = yield* loadArtifacts(root, "user");
    yield* run(async () => writeFile(path.join(server, "index.js.map"), '{"version":3}'));
    const mapChanged = yield* loadArtifacts(root, "user");
    yield* run(async () =>
      writeFile(path.join(server, "chunks/handler.js"), "export default { changed: true };"),
    );
    const codeChanged = yield* loadArtifacts(root, "user");
    assert.strictEqual(mapChanged.release, first.release);
    assert.notStrictEqual(codeChanged.release, first.release);
  }).pipe(Effect.scoped),
);

for (const filename of [
  ".dev.vars",
  ".dev.vars.production",
  ".env",
  ".env.production",
  ".env-backup",
  "wrangler.json",
  "private.key",
  ".git/config",
  ".vite/manifest.json",
]) {
  it.effect(`refuses private client artifact ${filename} before copying anything`, () =>
    Effect.gen(function* program() {
      const root = yield* temporaryRoot;
      const client = path.join(root, "apps/user/dist/client");
      const server = path.join(root, "apps/user/dist/server");
      yield* run(async () => {
        await writeFiles(client, { [filename]: "private" });
        await writeFiles(server, { "index.js": "export default {};" });
      });
      assert.strictEqual(yield* failureCode(root, "user"), "private_client_artifact");
    }).pipe(Effect.scoped),
  );
}

it.effect("refuses symlinks in upload roots", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const dist = path.join(root, "apps/admin/dist");
    yield* run(async () => {
      await mkdir(path.join(dist, "server"), { recursive: true });
      await mkdir(path.join(root, "private"));
      await symlink(path.join(root, "private"), path.join(dist, "client"));
    });
    assert.strictEqual(yield* failureCode(root, "admin"), "artifact_directory_symlink_forbidden");
  }).pipe(Effect.scoped),
);
