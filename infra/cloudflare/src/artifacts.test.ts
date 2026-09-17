import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assert, it } from "@effect/vitest";
import type { Application } from "@template/config";
import { Effect } from "effect";
import { loadArtifacts } from "./artifacts.ts";

const temporaryRoot = Effect.acquireRelease(
  Effect.promise(async () => realpath(await mkdtemp(path.join(tmpdir(), "template-artifacts-")))),
  (root) => Effect.promise(() => rm(root, { recursive: true, force: true })),
);

const run = <A>(operation: () => Promise<A>) => Effect.promise(operation);

const failureCode = (root: string, target: Application) =>
  loadArtifacts(root, target).pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );

it.effect(
  "uploads server chunks with their source maps but excludes private client source maps",
  () =>
    Effect.gen(function* () {
      const root = yield* temporaryRoot;
      const client = path.join(root, "apps/user/dist/client");
      const server = path.join(root, "apps/user/dist/server");
      yield* run(async () => {
        await mkdir(client, { recursive: true });
        await mkdir(path.join(server, "chunks"), { recursive: true });
        await writeFile(path.join(client, "app.js"), "export const publicValue = 1;");
        await writeFile(path.join(client, "app.js.map"), "private source map");
        await writeFile(path.join(server, ".dev.vars"), "AUTH_SECRET=private");
        await writeFile(path.join(server, ".env.production"), "AUTH_SECRET=private");
        await mkdir(path.join(server, ".vite"));
        await writeFile(path.join(server, ".vite", "manifest.json"), "{}");
        await writeFile(path.join(client, "styles.css"), "body{color:red}");
        await writeFile(path.join(server, "styles.css"), "body{color:red}");
        await writeFile(
          path.join(server, "index.js"),
          'export { default } from "./chunks/handler.js";',
        );
        await writeFile(path.join(server, "chunks/handler.js"), "export default {};");
        await writeFile(path.join(server, "index.js.map"), "{}");
        await writeFile(path.join(server, "orphan.js.map"), "{}");
      });
      const artifacts = yield* loadArtifacts(root, "user");
      assert.deepStrictEqual(
        artifacts.modules.map((module) => [module.name, module.contentType]),
        [
          ["chunks/handler.js", "application/javascript+module"],
          ["index.js", "application/javascript+module"],
          ["index.js.map", "application/source-map"],
        ],
      );
      assert.match(artifacts.release, /^[0-9a-f]{16}$/);
      assert.deepStrictEqual(yield* run(() => readdir(artifacts.clientDirectory)), [
        "app.js",
        "styles.css",
      ]);
      assert.strictEqual(
        yield* run(() => readFile(path.join(client, "app.js.map"), "utf8")),
        "private source map",
      );
      assert.strictEqual(
        (yield* loadArtifacts(root, "user")).clientDirectory,
        artifacts.clientDirectory,
      );
      yield* run(() => writeFile(path.join(server, "styles.css"), "body{color:blue}"));
      assert.strictEqual(yield* failureCode(root, "user"), "server_css_without_public_asset");
      yield* run(() => writeFile(path.join(server, "styles.css"), "body{color:red}"));
      const protectedFile = path.join(root, "protected.txt");
      yield* run(async () => {
        await writeFile(protectedFile, "do not overwrite");
        await unlink(path.join(artifacts.clientDirectory, "app.js"));
        await symlink(protectedFile, path.join(artifacts.clientDirectory, "app.js"));
      });
      assert.strictEqual(yield* failureCode(root, "user"), "artifact_staging_link_forbidden");
      assert.strictEqual(yield* run(() => readFile(protectedFile, "utf8")), "do not overwrite");
      yield* run(() => writeFile(path.join(client, "app.js"), "export const publicValue = 2;"));
      const changedClient = yield* loadArtifacts(root, "user");
      assert.notStrictEqual(changedClient.clientDirectory, artifacts.clientDirectory);
      assert.notStrictEqual(changedClient.release, artifacts.release);
      yield* run(() => writeFile(path.join(server, "index.js.map"), '{"version":3}'));
      assert.strictEqual((yield* loadArtifacts(root, "user")).release, changedClient.release);
      yield* run(() =>
        writeFile(path.join(server, "chunks/handler.js"), "export default { changed: true };"),
      );
      assert.notStrictEqual((yield* loadArtifacts(root, "user")).release, changedClient.release);
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
  "Pulumi.production.yaml",
])
  it.effect(`refuses private client artifact ${filename} before copying anything`, () =>
    Effect.gen(function* () {
      const root = yield* temporaryRoot;
      const client = path.join(root, "apps/user/dist/client");
      const server = path.join(root, "apps/user/dist/server");
      yield* run(async () => {
        await mkdir(path.dirname(path.join(client, filename)), { recursive: true });
        await mkdir(server, { recursive: true });
        await writeFile(path.join(client, filename), "private");
        await writeFile(path.join(server, "index.js"), "export default {};");
      });
      assert.strictEqual(yield* failureCode(root, "user"), "private_client_artifact");
    }).pipe(Effect.scoped),
  );

it.effect("refuses symlinks in upload roots", () =>
  Effect.gen(function* () {
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
