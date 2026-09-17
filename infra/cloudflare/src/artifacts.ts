import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Effect, Schema } from "effect";
import type { AppTarget } from "./config.ts";

export class ArtifactFailure extends Schema.TaggedError<ArtifactFailure>()("ArtifactFailure", {
  code: Schema.Literals([
    "artifact_io_failed",
    "artifact_symlink_forbidden",
    "artifact_file_type_invalid",
    "artifact_directory_symlink_forbidden",
    "private_client_artifact",
    "client_artifacts_empty",
    "worker_entry_missing_index_js",
    "worker_entry_empty",
    "worker_module_type_unsupported",
    "server_css_without_public_asset",
    "artifact_staging_symlink_forbidden",
    "artifact_staging_link_forbidden",
    "artifact_staging_contaminated",
    "source_map_directory_invalid",
    "source_map_symlink_forbidden",
    "budget_worker_artifact_empty",
    "error_worker_artifact_empty",
  ]),
}) {}

export const fail = (code: ArtifactFailure["code"]) => Effect.fail(new ArtifactFailure({ code }));

export const io = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: () => new ArtifactFailure({ code: "artifact_io_failed" }) });

const sha256 = (content: string | Buffer) => createHash("sha256").update(content).digest("hex");

function privateArtifact(relative: string): boolean {
  return relative
    .split(path.sep)
    .some(
      (name) =>
        /^(?:\.env.*|\.dev\.vars.*|\.git|\.vite|\.npmrc|wrangler\..*|Pulumi(?:\..*)?\.ya?ml)$/.test(
          name,
        ) || /\.(?:pem|key)$/.test(name),
    );
}

const files: (directory: string) => Effect.Effect<string[], ArtifactFailure> = Effect.fn("files")(
  function* (directory: string) {
    const entries = yield* io(() => readdir(directory, { withFileTypes: true }));
    const nested = yield* Effect.forEach(
      entries,
      (entry) =>
        Effect.gen(function* () {
          if (entry.isSymbolicLink()) return yield* fail("artifact_symlink_forbidden");
          const filename = path.join(directory, entry.name);
          if (entry.isDirectory()) return yield* files(filename);
          if (!entry.isFile()) return yield* fail("artifact_file_type_invalid");
          return [filename];
        }),
      { concurrency: "unbounded" },
    );
    return nested.flat().sort();
  },
);

const copyStagedFile = Effect.fn("copyStagedFile")(function* (source: string, destination: string) {
  yield* Effect.tryPromise({
    try: () => copyFile(source, destination, constants.COPYFILE_EXCL),
    catch: (cause) => ({ cause }),
  }).pipe(
    Effect.catch(({ cause: error }) =>
      Effect.gen(function* () {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST")
          return yield* fail("artifact_io_failed");
        const existing = yield* io(() => lstat(destination));
        if (!existing.isFile() || existing.nlink !== 1)
          return yield* fail("artifact_staging_link_forbidden");
        const [sourceContent, destinationContent] = yield* io(() =>
          Promise.all([readFile(source), readFile(destination)]),
        );
        if (!sourceContent.equals(destinationContent))
          return yield* fail("artifact_staging_contaminated");
      }),
    ),
  );
});

export const loadArtifacts = Effect.fn("loadArtifacts")(function* (
  repositoryRoot: string,
  target: AppTarget,
) {
  const root = path.join(repositoryRoot, "apps", target, "dist");
  const server = path.join(root, "server");
  const client = path.join(root, "client");
  for (const directory of [root, server, client]) {
    if ((yield* io(() => realpath(directory))) !== directory)
      return yield* fail("artifact_directory_symlink_forbidden");
  }
  const allClientFiles = yield* files(client);
  if (allClientFiles.some((file) => privateArtifact(path.relative(client, file))))
    return yield* fail("private_client_artifact");
  const clientFiles = allClientFiles.filter((file) => !file.endsWith(".map"));
  if (clientFiles.length === 0) return yield* fail("client_artifacts_empty");
  const allServerFiles = (yield* files(server)).filter(
    (file) => !privateArtifact(path.relative(server, file)),
  );
  const serverFiles = allServerFiles.filter((file) => !file.endsWith(".map"));
  const mainModule = "index.js";
  if (!serverFiles.includes(path.join(server, mainModule)))
    return yield* fail("worker_entry_missing_index_js");
  const modules = yield* Effect.forEach(
    serverFiles,
    (file) =>
      Effect.gen(function* () {
        const extension = path.extname(file);
        if (extension === ".css") {
          const publicFile = path.join(client, path.relative(server, file));
          if (!clientFiles.includes(publicFile))
            return yield* fail("server_css_without_public_asset");
          const [serverContent, publicContent] = yield* io(() =>
            Promise.all([readFile(file), readFile(publicFile)]),
          );
          if (!serverContent.equals(publicContent))
            return yield* fail("server_css_without_public_asset");
          return undefined;
        }
        const contentType =
          extension === ".js" || extension === ".mjs"
            ? "application/javascript+module"
            : extension === ".wasm"
              ? "application/wasm"
              : extension === ".txt"
                ? "text/plain"
                : undefined;
        if (!contentType) return yield* fail("worker_module_type_unsupported");
        return {
          name: path.relative(server, file).replaceAll(path.sep, "/"),
          contentFile: file,
          contentSha256: sha256(yield* io(() => readFile(file))),
          contentType,
        };
      }),
    { concurrency: "unbounded" },
  );
  const codeModules = modules.filter((module) => module !== undefined);
  const sourceMaps = yield* Effect.forEach(
    allServerFiles.filter(
      (file) =>
        file.endsWith(".map") &&
        codeModules.some((module) => module.contentFile === file.slice(0, -".map".length)),
    ),
    (file) =>
      io(() => readFile(file)).pipe(
        Effect.map((content) => ({
          name: path.relative(server, file).replaceAll(path.sep, "/"),
          contentFile: file,
          contentSha256: sha256(content),
          contentType: "application/source-map",
        })),
      ),
    { concurrency: "unbounded" },
  );
  if ((yield* io(() => stat(path.join(server, mainModule)))).size === 0)
    return yield* fail("worker_entry_empty");
  const manifest = yield* Effect.forEach(
    clientFiles,
    (file) =>
      io(() => readFile(file)).pipe(
        Effect.map((content) => [path.relative(client, file), sha256(content)]),
      ),
    { concurrency: "unbounded" },
  );
  const digest = sha256(JSON.stringify(manifest));
  const release = sha256(
    JSON.stringify([codeModules.map((module) => [module.name, module.contentSha256]), digest]),
  ).slice(0, 16);
  const staging = path.join(repositoryRoot, "infra", "cloudflare", ".artifacts", target, digest);
  yield* io(() => mkdir(staging, { recursive: true }));
  if ((yield* io(() => realpath(staging))) !== staging)
    return yield* fail("artifact_staging_symlink_forbidden");
  for (const source of clientFiles) {
    const destination = path.join(staging, path.relative(client, source));
    yield* io(() => mkdir(path.dirname(destination), { recursive: true }));
    if ((yield* io(() => realpath(path.dirname(destination)))) !== path.dirname(destination))
      return yield* fail("artifact_staging_symlink_forbidden");
    yield* copyStagedFile(source, destination);
  }
  const stagedFiles = yield* files(staging);
  if (
    stagedFiles.length !== clientFiles.length ||
    stagedFiles.some(
      (file) => !clientFiles.includes(path.join(client, path.relative(staging, file))),
    )
  )
    return yield* fail("artifact_staging_contaminated");
  return {
    mainModule,
    modules: [...codeModules, ...sourceMaps],
    clientDirectory: staging,
    release,
  };
});
