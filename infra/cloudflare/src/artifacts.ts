import {
  assertRealDirectory,
  fail,
  fileSha256,
  files,
  io,
  jsonSha256,
  sameContent,
} from "./artifact-io.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, stat } from "node:fs/promises";
import type { Application } from "@template/config";
import type { ArtifactFailure } from "./artifact-io.ts";
import { Effect } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { stageClientFiles } from "./staging.ts";

const MAIN_MODULE = "index.js";
const RELEASE_LENGTH = 16;
const SERVER_ONLY_MARKERS: readonly string[] = ["drizzle:entityKind", "better-auth/api"];
const MODULE_CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  [".js", "application/javascript+module"],
  [".mjs", "application/javascript+module"],
  [".txt", "text/plain"],
  [".wasm", "application/wasm"],
]);

interface WorkerModule {
  readonly contentFile: string;
  readonly contentType: string;
  readonly name: string;
}

interface Artifacts {
  readonly clientDirectory: string;
  readonly mainModule: string;
  readonly modules: readonly WorkerModule[];
  readonly release: string;
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
        /^(?:\.env.*|\.dev\.vars.*|\.git|\.vite|\.npmrc|wrangler\..*|Pulumi(?:\..*)?\.ya?ml)$/u.test(
          name,
        ) || /\.(?:pem|key)$/u.test(name),
    );
}

function carriesServerOnlyCode(file: string): Effect.Effect<boolean, ArtifactFailure> {
  return io(async () => readFile(file, "utf-8")).pipe(
    Effect.map((source) => SERVER_ONLY_MARKERS.some((marker) => source.includes(marker))),
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
  const contentType = MODULE_CONTENT_TYPES.get(path.extname(file));
  return contentType === undefined
    ? fail("worker_module_type_unsupported")
    : Effect.succeed({
        contentFile: file,
        contentType,
        name: path.relative(server, file).replaceAll(path.sep, "/"),
      });
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
      contentType: "application/source-map",
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

function clientDigest(
  client: string,
  clientFiles: readonly string[],
): Effect.Effect<string, ArtifactFailure> {
  return Effect.all(
    clientFiles.map((file) =>
      fileSha256(file).pipe(Effect.map((hash) => [path.relative(client, file), hash])),
    ),
    { concurrency: "unbounded" },
  ).pipe(Effect.flatMap(jsonSha256));
}

function releaseId(
  codeModules: readonly WorkerModule[],
  digest: string,
): Effect.Effect<string, ArtifactFailure> {
  return Effect.all(
    codeModules.map((module) =>
      fileSha256(module.contentFile).pipe(Effect.map((hash) => [module.name, hash])),
    ),
    { concurrency: "unbounded" },
  ).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.flatMap((manifest) => jsonSha256([manifest, digest])),
    Effect.map((hash) => hash.slice(0, RELEASE_LENGTH)),
  );
}

const buildOutput = Effect.fn("buildOutput")(function* buildOutput(
  repositoryRoot: string,
  target: Application,
) {
  const root = path.join(repositoryRoot, "apps", target, "dist");
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

const loadArtifacts = Effect.fn("loadArtifacts")(function* loadArtifacts(
  repositoryRoot: string,
  target: Application,
) {
  const output = yield* buildOutput(repositoryRoot, target);
  const clientFiles = yield* clientArtifactFiles(output.client);
  const { code, sourceMaps } = yield* loadWorkerModules(output, clientFiles);
  const digest = yield* clientDigest(output.client, clientFiles);
  const release = yield* releaseId(code, digest);
  const staging = path.join(repositoryRoot, "infra", "cloudflare", ".artifacts", target, digest);
  yield* stageClientFiles(output.client, staging, clientFiles);
  const artifacts: Artifacts = {
    clientDirectory: staging,
    mainModule: MAIN_MODULE,
    modules: [...code, ...sourceMaps],
    release,
  };
  return artifacts;
});

export { loadArtifacts };
