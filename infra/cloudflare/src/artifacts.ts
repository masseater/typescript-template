// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, stat } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { Context, Effect } from "effect";

import type { Application } from "@template/config";
import { serverOnlyMarkers } from "@template/config/vite";

import {
  assertRealDirectory,
  fail,
  fileSha256,
  files,
  io,
  jsonSha256,
  sameContent,
} from "./artifact-io.ts";
import type { ArtifactFailure } from "./artifact-io.ts";
import { retainGenerations } from "./retention.ts";
import { archiveSourceMaps } from "./source-maps.ts";
import { stageFiles } from "./staging.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

const MAIN_MODULE = "index.js";

function monitorArtifact(unit: string): string {
  return path.join(repositoryRoot, "infra", unit, "dist", MAIN_MODULE);
}

const RELEASE_LENGTH = 16;
const STAGED_DIGESTS_KEPT = 1;
const ARCHIVED_RELEASES_KEPT = 5;

type ArtifactMode = "describe" | "publish" | "stage";

const ArtifactWrites = Context.Reference<ArtifactMode>("template/cloudflare/ArtifactWrites", {
  defaultValue: (): ArtifactMode => "describe",
});
const MODULE_EXTENSIONS: ReadonlySet<string> = new Set([".js", ".mjs", ".txt", ".wasm"]);

interface WorkerModule {
  readonly contentFile: string;
  readonly name: string;
}

const workerModuleGlobs = [
  ...[...MODULE_EXTENSIONS].map((extension) => `**/*${extension}`),
  "**/*.map",
];

interface Artifacts {
  readonly clientDirectory: string;
  readonly clientFiles: readonly string[];
  readonly mainModule: string;
  readonly modules: readonly WorkerModule[];
  readonly release: string;
  readonly uploaded: string;
}

interface BuildOutput {
  readonly client: string;
  readonly server: string;
}

function privateArtifact(relative: string): boolean {
  return relative
    .split(path.sep)
    .some(
      (name) =>
        /^(?:\.env.*|\.dev\.vars.*|\.git|\.vite|\.npmrc|wrangler\..*)$/u.test(name) ||
        /\.(?:pem|key)$/u.test(name),
    );
}

function carriesServerOnlyCode(file: string): Effect.Effect<boolean, ArtifactFailure> {
  return io(async () => readFile(file, "utf-8")).pipe(
    Effect.map((source) => serverOnlyMarkers.some((marker) => source.includes(marker))),
  );
}

const clientArtifactFiles = Effect.fn("clientArtifactFiles")(function* clientArtifactFiles(
  client: string,
) {
  const allClientFiles = yield* files(client);
  if (allClientFiles.some((file) => privateArtifact(path.relative(client, file)))) {
    return yield* fail("private_client_artifact");
  }
  const clientFiles = allClientFiles.filter((file) => !file.endsWith(".map"));
  if (clientFiles.length === 0) {
    return yield* fail("client_artifacts_empty");
  }
  const scripts = yield* Effect.all(
    clientFiles.filter((file) => /\.m?js$/u.test(file)).map((file) => carriesServerOnlyCode(file)),
    { concurrency: "unbounded" },
  );
  if (scripts.includes(true)) {
    return yield* fail("server_only_code_in_client");
  }
  return clientFiles;
});

function assertServerCssPublished(
  output: BuildOutput,
  cssFiles: readonly string[],
  clientFiles: readonly string[],
): Effect.Effect<void, ArtifactFailure> {
  return Effect.all(
    cssFiles.map((file) => {
      const publicFile = path.join(output.client, path.relative(output.server, file));
      const published = clientFiles.includes(publicFile)
        ? sameContent(file, publicFile)
        : Effect.succeed(false);
      return published.pipe(
        Effect.flatMap((same) => (same ? Effect.void : fail("server_css_without_public_asset"))),
      );
    }),
    { concurrency: "unbounded", discard: true },
  );
}

function workerModule(server: string, file: string): Effect.Effect<WorkerModule, ArtifactFailure> {
  return MODULE_EXTENSIONS.has(path.extname(file))
    ? Effect.succeed({
        contentFile: file,
        name: path.relative(server, file).replaceAll(path.sep, "/"),
      })
    : fail("worker_module_type_unsupported");
}

function sourceMapModules(
  server: string,
  serverFiles: readonly string[],
  codeModules: readonly WorkerModule[],
): WorkerModule[] {
  const codeFiles = new Set(codeModules.map((module) => module.contentFile));
  return serverFiles
    .filter((file) => file.endsWith(".map") && codeFiles.has(file.slice(0, -".map".length)))
    .map((file) => ({
      contentFile: file,
      name: path.relative(server, file).replaceAll(path.sep, "/"),
    }));
}

const loadWorkerModules = Effect.fn("loadWorkerModules")(function* loadWorkerModules(
  output: BuildOutput,
  clientFiles: readonly string[],
) {
  const allServerFiles = (yield* files(output.server)).filter(
    (file) => !privateArtifact(path.relative(output.server, file)),
  );
  const serverFiles = allServerFiles.filter((file) => !file.endsWith(".map"));
  if (!serverFiles.includes(path.join(output.server, MAIN_MODULE))) {
    return yield* fail("worker_entry_missing_index_js");
  }
  const cssFiles = serverFiles.filter((file) => path.extname(file) === ".css");
  const code = yield* Effect.all(
    serverFiles
      .filter((file) => path.extname(file) !== ".css")
      .map((file) => workerModule(output.server, file)),
  );
  yield* assertServerCssPublished(output, cssFiles, clientFiles);
  if ((yield* io(async () => stat(path.join(output.server, MAIN_MODULE)))).size === 0) {
    return yield* fail("worker_entry_empty");
  }
  return { code, sourceMaps: sourceMapModules(output.server, allServerFiles, code) };
});

function manifestDigest(
  root: string,
  contentFiles: readonly string[],
): Effect.Effect<string, ArtifactFailure> {
  return Effect.all(
    contentFiles.map((file) =>
      fileSha256(file).pipe(Effect.map((hash) => [path.relative(root, file), hash])),
    ),
    { concurrency: "unbounded" },
  ).pipe(Effect.flatMap(jsonSha256));
}

const buildOutput = Effect.fn("buildOutput")(function* buildOutput(
  repository: string,
  target: Application,
) {
  const root = path.join(repository, "apps", target, "dist");
  const output: BuildOutput = {
    client: path.join(root, "client"),
    server: path.join(root, "server"),
  };
  yield* Effect.all(
    [root, output.server, output.client].map((directory) =>
      assertRealDirectory(directory, "artifact_directory_symlink_forbidden"),
    ),
    { discard: true },
  );
  return output;
});

function serverDigest(
  server: string,
  modules: readonly WorkerModule[],
): Effect.Effect<string, ArtifactFailure> {
  return manifestDigest(
    server,
    modules.map((module) => module.contentFile),
  );
}

const digests = Effect.fn("digests")(function* digests(
  output: BuildOutput,
  clientFiles: readonly string[],
  server: Readonly<{ code: readonly WorkerModule[]; modules: readonly WorkerModule[] }>,
) {
  const { code, modules } = server;
  const client = yield* manifestDigest(output.client, clientFiles);
  const release = yield* jsonSha256([yield* serverDigest(output.server, code), client]);
  const uploaded = yield* jsonSha256([yield* serverDigest(output.server, modules), client]);
  return { release: release.slice(0, RELEASE_LENGTH), uploaded };
});

function stagedRoot(repository: string, target: Application): string {
  return path.join(repository, "infra", "cloudflare", ".artifacts", target);
}

const materialize = Effect.fn("materialize")(function* materialize(
  place: { readonly repository: string; readonly target: Application },
  output: BuildOutput,
  artifacts: Artifacts,
) {
  const mode = yield* ArtifactWrites;
  if (mode === "describe") {
    return;
  }
  yield* Effect.all([
    stageFiles(output.client, artifacts.clientDirectory, artifacts.clientFiles),
    stageFiles(
      output.server,
      path.dirname(artifacts.mainModule),
      artifacts.modules.map((module) => module.contentFile),
    ),
  ]);
  yield* archiveSourceMaps(place.repository, place.target, artifacts.release);
  if (mode !== "publish") {
    return;
  }
  yield* Effect.all([
    retainGenerations(
      stagedRoot(place.repository, place.target),
      artifacts.uploaded,
      STAGED_DIGESTS_KEPT,
    ),
    retainGenerations(
      path.join(place.repository, ".local", "source-maps", place.target, "releases"),
      artifacts.release,
      ARCHIVED_RELEASES_KEPT,
    ),
  ]);
});

const loadArtifacts = Effect.fn("loadArtifacts")(function* loadArtifacts(
  repository: string,
  target: Application,
) {
  const output = yield* buildOutput(repository, target);
  const clientFiles = yield* clientArtifactFiles(output.client);
  const { code, sourceMaps } = yield* loadWorkerModules(output, clientFiles);
  const modules = [...code, ...sourceMaps];
  const { release, uploaded } = yield* digests(output, clientFiles, { code, modules });
  const staging = path.join(stagedRoot(repository, target), uploaded);
  const artifacts: Artifacts = {
    clientDirectory: path.join(staging, "client"),
    clientFiles,
    mainModule: path.join(staging, "server", MAIN_MODULE),
    modules,
    release,
    uploaded,
  };
  yield* materialize({ repository, target }, output, artifacts);
  return artifacts;
});

export { ArtifactWrites, loadArtifacts, monitorArtifact, repositoryRoot, workerModuleGlobs };
export type { ArtifactMode };
