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
import { tmpdir } from "node:os";
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { SOURCE_MAP_MANIFEST, sourceMapDirectories } from "@repo/vite-config/source-maps";
import { Effect } from "effect";

import { ArtifactWrites, loadArtifacts } from "./artifacts.ts";

import type { Application } from "@repo/config";
import type { ArtifactFailure } from "./artifact-io.ts";

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
  const client = path.join(root, "apps/service-member/dist/client");
  const server = path.join(root, "apps/service-member/dist/server");
  await writeFiles(client, {
    "app.js": "export const publicValue = 1;",
    "app.js.map": "private source map",
    "face.woff2": "font",
    "styles.css": "body{color:red}",
  });
  await writeFiles(sourceMapDirectories(root, "service-member").client, {
    "app.js.map": "private source map",
    [SOURCE_MAP_MANIFEST]: JSON.stringify(["app.js.map"]),
  });
  await writeFiles(server, {
    ".dev.vars": "AUTH_SECRET=private",
    ".env.production": "AUTH_SECRET=private",
    ".vite/manifest.json": "{}",
    "chunks/handler.js": "export default {};",
    "face.woff2": "font",
    "index.js": 'export { default } from "./chunks/handler.js";',
    "styles.css": "body{color:red}",
  });
  return { client, root, server };
}

const userBuild: Effect.Effect<UserBuild, never, Scope.Scope> = temporaryRoot.pipe(
  Effect.flatMap((root) => run(async () => writeUserBuild(root))),
);

function load(root: string, target: Application): ReturnType<typeof loadArtifacts> {
  return loadArtifacts(root, target).pipe(Effect.provideService(ArtifactWrites, "publish"));
}

function failureCode(
  root: string,
  target: Application,
): Effect.Effect<ArtifactFailure["code"], Effect.Success<ReturnType<typeof loadArtifacts>>> {
  return load(root, target).pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );
}

it.effect(
  "uploads server chunks with their source maps but excludes private client source maps",
  () =>
    Effect.gen(function* program() {
      const { client, root, server } = yield* userBuild;
      yield* run(async () => writeFiles(server, { "index.js.map": "{}", "orphan.js.map": "{}" }));
      const artifacts = yield* load(root, "service-member");
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
        "face.woff2",
        "styles.css",
      ]);
      assert.ok(artifacts.modules.every((module) => path.extname(module.name) !== ".woff2"));
      assert.strictEqual(
        yield* run(async () => readFile(path.join(client, "app.js.map"), "utf-8")),
        "private source map",
      );
    }).pipe(Effect.scoped),
);

it.effect("reuses the staging directory for unchanged client content", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const first = yield* load(root, "service-member");
    const second = yield* load(root, "service-member");
    assert.strictEqual(second.clientDirectory, first.clientDirectory);
  }).pipe(Effect.scoped),
);

it.effect("resolves the upload without writing anything outside a deployment", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const artifacts = yield* loadArtifacts(root, "service-member");
    assert.include(artifacts.clientDirectory, artifacts.uploaded);
    assert.deepStrictEqual(
      yield* run(async () => readdir(path.join(root, "infra", "cloudflare")).catch(() => [])),
      [],
    );
    assert.deepStrictEqual(
      yield* run(async () =>
        readdir(path.dirname(sourceMapDirectories(root, "service-member").client)),
      ),
      ["client"],
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses to publish a build that never recorded what its maps were", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const kept = sourceMapDirectories(root, "service-member").client;
    yield* run(async () => rm(path.join(kept, SOURCE_MAP_MANIFEST)));
    assert.strictEqual(yield* failureCode(root, "service-member"), "source_maps_missing");
  }).pipe(Effect.scoped),
);

it.effect("publishes a build whose bundler emitted no map for a generated chunk", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    yield* run(async () =>
      writeFiles(client, { "rolldown-runtime.js": "export const helper = 1;" }),
    );
    const artifacts = yield* load(root, "service-member");
    assert.include(
      artifacts.clientFiles.map((file) => path.basename(file)),
      "rolldown-runtime.js",
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses to publish a build whose client source maps were never kept", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const kept = sourceMapDirectories(root, "service-member").client;
    yield* run(async () => rm(path.join(kept, "app.js.map")));
    assert.strictEqual(yield* failureCode(root, "service-member"), "source_maps_missing");
    assert.deepStrictEqual(
      yield* run(async () => readdir(path.join(root, "infra")).catch(() => [])),
      [],
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses to publish when the client source map directory is missing", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    yield* run(async () =>
      rm(sourceMapDirectories(root, "service-member").client, { recursive: true }),
    );
    assert.strictEqual(yield* failureCode(root, "service-member"), "source_maps_missing");
    assert.deepStrictEqual(
      yield* run(async () => readdir(path.join(root, "infra")).catch(() => [])),
      [],
    );
  }).pipe(Effect.scoped),
);

it.effect("describes a build without its private source maps", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    yield* run(async () => rm(path.join(root, ".local"), { force: true, recursive: true }));
    const artifacts = yield* loadArtifacts(root, "service-member");
    assert.include(artifacts.clientDirectory, artifacts.uploaded);
  }).pipe(Effect.scoped),
);

it.effect("leaves earlier digests alone while a preview is still awaiting approval", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    const first = yield* loadArtifacts(root, "service-member").pipe(
      Effect.provideService(ArtifactWrites, "stage"),
    );
    yield* run(async () => writeFile(path.join(client, "app.js"), "export const publicValue = 4;"));
    const second = yield* loadArtifacts(root, "service-member").pipe(
      Effect.provideService(ArtifactWrites, "stage"),
    );
    assert.deepStrictEqual(
      (yield* run(async () =>
        readdir(path.join(root, "infra", "cloudflare", ".artifacts", "service-member")),
      )).toSorted(),
      [first.uploaded, second.uploaded].toSorted(),
    );
  }).pipe(Effect.scoped),
);

it.effect("keeps only the staged digest a deployment is about to upload", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    const first = yield* load(root, "service-member");
    yield* run(async () => writeFile(path.join(client, "app.js"), "export const publicValue = 3;"));
    const second = yield* load(root, "service-member");
    assert.notStrictEqual(second.uploaded, first.uploaded);
    assert.deepStrictEqual(
      yield* run(async () =>
        readdir(path.join(root, "infra", "cloudflare", ".artifacts", "service-member")),
      ),
      [second.uploaded],
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses server CSS that differs from its public asset", () =>
  Effect.gen(function* program() {
    const { root, server } = yield* userBuild;
    yield* run(async () => writeFile(path.join(server, "styles.css"), "body{color:blue}"));
    assert.strictEqual(
      yield* failureCode(root, "service-member"),
      "server_css_without_public_asset",
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses server fonts that are missing from the public client assets", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    yield* run(async () => unlink(path.join(client, "face.woff2")));
    assert.strictEqual(
      yield* failureCode(root, "service-member"),
      "server_css_without_public_asset",
    );
  }).pipe(Effect.scoped),
);

it.effect("never writes through a link placed in the staging directory", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const artifacts = yield* load(root, "service-member");
    const protectedFile = path.join(root, "protected.txt");
    yield* run(async () => {
      await writeFile(protectedFile, "do not overwrite");
      await unlink(path.join(artifacts.clientDirectory, "app.js"));
      await symlink(protectedFile, path.join(artifacts.clientDirectory, "app.js"));
    });
    assert.strictEqual(
      yield* failureCode(root, "service-member"),
      "artifact_staging_link_forbidden",
    );
    assert.strictEqual(
      yield* run(async () => readFile(protectedFile, "utf-8")),
      "do not overwrite",
    );
  }).pipe(Effect.scoped),
);

it.effect("stages changed client content in a new directory", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    const first = yield* load(root, "service-member");
    yield* run(async () => writeFile(path.join(client, "app.js"), "export const publicValue = 2;"));
    const second = yield* load(root, "service-member");
    assert.notStrictEqual(second.clientDirectory, first.clientDirectory);
    assert.notStrictEqual(second.release, first.release);
  }).pipe(Effect.scoped),
);

it.effect("derives the release from code and client content but not from source maps", () =>
  Effect.gen(function* program() {
    const { root, server } = yield* userBuild;
    yield* run(async () => writeFiles(server, { "index.js.map": "{}" }));
    const first = yield* load(root, "service-member");
    yield* run(async () => writeFile(path.join(server, "index.js.map"), '{"version":3}'));
    const mapChanged = yield* load(root, "service-member");
    yield* run(async () =>
      writeFile(path.join(server, "chunks/handler.js"), "export default { changed: true };"),
    );
    const codeChanged = yield* load(root, "service-member");
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
      const client = path.join(root, "apps/service-member/dist/client");
      const server = path.join(root, "apps/service-member/dist/server");
      yield* run(async () => {
        await writeFiles(client, { [filename]: "private" });
        await writeFiles(server, { "index.js": "export default {};" });
      });
      assert.strictEqual(yield* failureCode(root, "service-member"), "private_client_artifact");
    }).pipe(Effect.scoped),
  );
}

it.effect("refuses symlinks in upload roots", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    const dist = path.join(root, "apps/service-admin/dist");
    yield* run(async () => {
      await mkdir(path.join(dist, "server"), { recursive: true });
      await mkdir(path.join(root, "private"));
      await symlink(path.join(root, "private"), path.join(dist, "client"));
    });
    assert.strictEqual(
      yield* failureCode(root, "service-admin"),
      "artifact_directory_symlink_forbidden",
    );
  }).pipe(Effect.scoped),
);
