import { tmpdir } from "node:os";

import { assert, it } from "@effect/vitest";
import { SOURCE_MAP_MANIFEST, sourceMapDirectories } from "@repo/vite-config/source-maps";
import { Effect, FileSystem, Schema } from "effect";

import { ArtifactWrites, loadArtifacts } from "./artifacts.ts";
import { layer, path } from "./platform.ts";

import type { Application } from "@repo/config";
import type { Scope } from "effect";
import type { ArtifactFailure } from "./artifact-io.ts";

interface UserBuild {
  readonly client: string;
  readonly root: string;
  readonly server: string;
}

function temporaryRoot(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* makeTemporary() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = yield* filesystem.makeTempDirectoryScoped({
      directory: tmpdir(),
      prefix: "template-artifacts-",
    });
    return yield* filesystem.realPath(directory);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

function writeFiles(
  directory: string,
  contents: Readonly<Record<string, string>>,
): Effect.Effect<void> {
  return Effect.gen(function* writeTree() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* Effect.forEach(
      Object.entries(contents),
      ([name, content]: readonly [string, string]) => {
        const filename = path.join(directory, name);
        return filesystem
          .makeDirectory(path.dirname(filename), { recursive: true })
          .pipe(Effect.andThen(filesystem.writeFileString(filename, content)));
      },
      { concurrency: "unbounded" },
    );
  }).pipe(Effect.orDie, Effect.provide(layer));
}

function writeUserBuild(root: string): Effect.Effect<UserBuild> {
  return Effect.gen(function* seedUserBuild() {
    const client = path.join(root, "apps/service-member/dist/client");
    const server = path.join(root, "apps/service-member/dist/server");
    const manifest = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))([
      "app.js.map",
    ]).pipe(Effect.orDie);
    yield* writeFiles(client, {
      "app.js": "export const publicValue = 1;",
      "app.js.map": "private source map",
      "face.woff2": "font",
      "styles.css": "body{color:red}",
    });
    yield* writeFiles(sourceMapDirectories(root, "service-member").client, {
      "app.js.map": "private source map",
      [SOURCE_MAP_MANIFEST]: manifest,
    });
    yield* writeFiles(server, {
      ".dev.vars": "AUTH_SECRET=private",
      ".env.production": "AUTH_SECRET=private",
      ".vite/manifest.json": "{}",
      "chunks/handler.js": "export default {};",
      "face.woff2": "font",
      "index.js": 'export { default } from "./chunks/handler.js";',
      "index.js.map": "{}",
      "styles.css": "body{color:red}",
    });
    return { client, root, server };
  });
}

const userBuild: Effect.Effect<UserBuild, never, Scope.Scope> = temporaryRoot().pipe(
  Effect.flatMap((root) => writeUserBuild(root)),
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

function readDirectory(location: string): Effect.Effect<string[]> {
  return Effect.gen(function* list() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readDirectory(location);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

function readDirectoryOrEmpty(location: string): Effect.Effect<string[]> {
  return Effect.gen(function* listOrEmpty() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readDirectory(location).pipe(Effect.orElseSucceed(() => []));
  }).pipe(Effect.provide(layer));
}

function readText(file: string): Effect.Effect<string> {
  return Effect.gen(function* read() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readFileString(file);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

function removePath(location: string, options?: { recursive?: boolean }): Effect.Effect<void> {
  return Effect.gen(function* remove() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem.remove(location, { force: true, recursive: options?.recursive });
  }).pipe(Effect.orDie, Effect.provide(layer));
}

it.effect(
  "uploads server chunks with their source maps but excludes private client source maps",
  () =>
    Effect.gen(function* program() {
      const { client, root, server } = yield* userBuild;
      yield* writeFiles(server, { "index.js.map": "{}", "orphan.js.map": "{}" });
      const artifacts = yield* load(root, "service-member");
      assert.deepStrictEqual(
        artifacts.modules.map((module) => module.name),
        ["chunks/handler.js", "index.js", "index.js.map"],
      );
      assert.deepStrictEqual(
        (yield* readDirectory(path.dirname(artifacts.mainModule))).toSorted(),
        ["chunks", "index.js", "index.js.map"],
      );
      assert.match(artifacts.release, /^[0-9a-f]{16}$/u);
      assert.deepStrictEqual(yield* readDirectory(artifacts.clientDirectory), [
        "app.js",
        "face.woff2",
        "styles.css",
      ]);
      assert.ok(artifacts.modules.every((module) => path.extname(module.name) !== ".woff2"));
      assert.strictEqual(yield* readText(path.join(client, "app.js.map")), "private source map");
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
    assert.deepStrictEqual(yield* readDirectoryOrEmpty(path.join(root, "infra", "cloudflare")), []);
    assert.deepStrictEqual(
      yield* readDirectory(path.dirname(sourceMapDirectories(root, "service-member").client)),
      ["client"],
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses to publish a build that never recorded what its maps were", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    const kept = sourceMapDirectories(root, "service-member").client;
    yield* removePath(path.join(kept, SOURCE_MAP_MANIFEST));
    assert.strictEqual(yield* failureCode(root, "service-member"), "source_maps_missing");
  }).pipe(Effect.scoped),
);

it.effect("publishes a build whose bundler emitted no map for a generated chunk", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    yield* writeFiles(client, { "rolldown-runtime.js": "export const helper = 1;" });
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
    yield* removePath(path.join(kept, "app.js.map"));
    assert.strictEqual(yield* failureCode(root, "service-member"), "source_maps_missing");
    assert.deepStrictEqual(yield* readDirectoryOrEmpty(path.join(root, "infra")), []);
  }).pipe(Effect.scoped),
);

it.effect("refuses to publish when the client source map directory is missing", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    yield* removePath(sourceMapDirectories(root, "service-member").client, { recursive: true });
    assert.strictEqual(yield* failureCode(root, "service-member"), "source_maps_missing");
    assert.deepStrictEqual(yield* readDirectoryOrEmpty(path.join(root, "infra")), []);
  }).pipe(Effect.scoped),
);

it.effect("describes a build without its private source maps", () =>
  Effect.gen(function* program() {
    const { root } = yield* userBuild;
    yield* removePath(path.join(root, ".local"), { recursive: true });
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
    yield* writeFiles(client, { "app.js": "export const publicValue = 4;" });
    const second = yield* loadArtifacts(root, "service-member").pipe(
      Effect.provideService(ArtifactWrites, "stage"),
    );
    assert.deepStrictEqual(
      (yield* readDirectory(
        path.join(root, "infra", "cloudflare", ".artifacts", "service-member"),
      )).toSorted(),
      [first.uploaded, second.uploaded].toSorted(),
    );
  }).pipe(Effect.scoped),
);

it.effect("keeps only the staged digest a deployment is about to upload", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    const first = yield* load(root, "service-member");
    yield* writeFiles(client, { "app.js": "export const publicValue = 3;" });
    const second = yield* load(root, "service-member");
    assert.notStrictEqual(second.uploaded, first.uploaded);
    assert.deepStrictEqual(
      yield* readDirectory(path.join(root, "infra", "cloudflare", ".artifacts", "service-member")),
      [second.uploaded],
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses server CSS that differs from its public asset", () =>
  Effect.gen(function* program() {
    const { root, server } = yield* userBuild;
    yield* writeFiles(server, { "styles.css": "body{color:blue}" });
    assert.strictEqual(
      yield* failureCode(root, "service-member"),
      "server_css_without_public_asset",
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses server fonts that are missing from the public client assets", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    yield* removePath(path.join(client, "face.woff2"));
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
    yield* Effect.gen(function* plantLink() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.writeFileString(protectedFile, "do not overwrite");
      yield* filesystem.remove(path.join(artifacts.clientDirectory, "app.js"));
      yield* filesystem.symlink(protectedFile, path.join(artifacts.clientDirectory, "app.js"));
    }).pipe(Effect.orDie, Effect.provide(layer));
    assert.strictEqual(
      yield* failureCode(root, "service-member"),
      "artifact_staging_link_forbidden",
    );
    assert.strictEqual(yield* readText(protectedFile), "do not overwrite");
  }).pipe(Effect.scoped),
);

it.effect("stages changed client content in a new directory", () =>
  Effect.gen(function* program() {
    const { client, root } = yield* userBuild;
    const first = yield* load(root, "service-member");
    yield* writeFiles(client, { "app.js": "export const publicValue = 2;" });
    const second = yield* load(root, "service-member");
    assert.notStrictEqual(second.clientDirectory, first.clientDirectory);
    assert.notStrictEqual(second.release, first.release);
  }).pipe(Effect.scoped),
);

it.effect("derives the release from code and client content but not from source maps", () =>
  Effect.gen(function* program() {
    const { root, server } = yield* userBuild;
    yield* writeFiles(server, { "index.js.map": "{}" });
    const first = yield* load(root, "service-member");
    yield* writeFiles(server, { "index.js.map": '{"version":3}' });
    const mapChanged = yield* load(root, "service-member");
    yield* writeFiles(server, { "chunks/handler.js": "export default { changed: true };" });
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
      const root = yield* temporaryRoot();
      const client = path.join(root, "apps/service-member/dist/client");
      const server = path.join(root, "apps/service-member/dist/server");
      yield* writeFiles(client, { [filename]: "private" });
      yield* writeFiles(server, { "index.js": "export default {};" });
      assert.strictEqual(yield* failureCode(root, "service-member"), "private_client_artifact");
    }).pipe(Effect.scoped),
  );
}

it.effect("refuses symlinks in upload roots", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot();
    const dist = path.join(root, "apps/service-admin/dist");
    yield* Effect.gen(function* plantUploadLink() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.makeDirectory(path.join(dist, "server"), { recursive: true });
      yield* filesystem.makeDirectory(path.join(root, "private"));
      yield* filesystem.symlink(path.join(root, "private"), path.join(dist, "client"));
    }).pipe(Effect.orDie, Effect.provide(layer));
    assert.strictEqual(
      yield* failureCode(root, "service-admin"),
      "artifact_directory_symlink_forbidden",
    );
  }).pipe(Effect.scoped),
);
