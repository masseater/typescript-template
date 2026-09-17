// oxlint-disable-next-line import/no-nodejs-modules
import {
  constants,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
} from "node:fs/promises";
import type { Application } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const MAIN_MODULE = "index.js";
const RELEASE_LENGTH = 16;
const MODULE_CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  [".js", "application/javascript+module"],
  [".mjs", "application/javascript+module"],
  [".txt", "text/plain"],
  [".wasm", "application/wasm"],
]);

interface WorkerModule {
  readonly contentFile: string;
  readonly contentSha256: string;
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

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(
      async (
        entry: Readonly<
          Pick<(typeof entries)[number], "isDirectory" | "isFile" | "isSymbolicLink" | "name">
        >,
      ) => {
        if (entry.isSymbolicLink()) {
          throw new Error("artifact_symlink_forbidden");
        }
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          return files(filename);
        }
        if (!entry.isFile()) {
          throw new Error("artifact_file_type_invalid");
        }
        return [filename];
      },
    ),
  );
  return nested.flat().toSorted();
}

async function fileSha256(file: string): Promise<string> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", await readFile(file))).toString("hex");
}

async function sameContent(left: string, right: string): Promise<boolean> {
  const [leftContent, rightContent] = await Promise.all([readFile(left), readFile(right)]);
  return leftContent.equals(rightContent);
}

async function assertRealDirectory(directory: string, error: string): Promise<void> {
  if ((await realpath(directory)) !== directory) {
    throw new Error(error);
  }
}

async function clientArtifactFiles(client: string): Promise<string[]> {
  const allClientFiles = await files(client);
  if (allClientFiles.some((file) => privateArtifact(path.relative(client, file)))) {
    throw new Error("private_client_artifact");
  }
  const clientFiles = allClientFiles.filter((file) => !file.endsWith(".map"));
  if (clientFiles.length === 0) {
    throw new Error("client_artifacts_empty");
  }
  return clientFiles;
}

async function serverArtifactFiles(server: string): Promise<string[]> {
  const serverFiles = await files(server);
  return serverFiles.filter((file) => !privateArtifact(path.relative(server, file)));
}

async function assertServerCssPublished(
  output: BuildOutput,
  cssFiles: readonly string[],
  clientFiles: readonly string[],
): Promise<void> {
  await Promise.all(
    cssFiles.map(async (file) => {
      const publicFile = path.join(output.client, path.relative(output.server, file));
      if (!clientFiles.includes(publicFile) || !(await sameContent(file, publicFile))) {
        throw new Error("server_css_without_public_asset");
      }
    }),
  );
}

async function workerModules(
  server: string,
  moduleFiles: readonly string[],
): Promise<WorkerModule[]> {
  return Promise.all(
    moduleFiles.map(async (file) => {
      const contentType = MODULE_CONTENT_TYPES.get(path.extname(file));
      if (contentType === undefined) {
        throw new Error("worker_module_type_unsupported");
      }
      return {
        contentFile: file,
        contentSha256: await fileSha256(file),
        contentType,
        name: path.relative(server, file).replaceAll(path.sep, "/"),
      };
    }),
  );
}

async function sourceMapModules(
  server: string,
  serverFiles: readonly string[],
  codeModules: readonly WorkerModule[],
): Promise<WorkerModule[]> {
  const codeFiles = new Set(codeModules.map((module) => module.contentFile));
  return Promise.all(
    serverFiles
      .filter((file) => file.endsWith(".map") && codeFiles.has(file.slice(0, -".map".length)))
      .map(async (file) => ({
        contentFile: file,
        contentSha256: await fileSha256(file),
        contentType: "application/source-map",
        name: path.relative(server, file).replaceAll(path.sep, "/"),
      })),
  );
}

async function assertWorkerEntryNotEmpty(server: string): Promise<void> {
  const entry = await stat(path.join(server, MAIN_MODULE));
  if (entry.size === 0) {
    throw new Error("worker_entry_empty");
  }
}

async function loadWorkerModules(
  output: BuildOutput,
  clientFiles: readonly string[],
): Promise<Readonly<{ code: WorkerModule[]; sourceMaps: WorkerModule[] }>> {
  const allServerFiles = await serverArtifactFiles(output.server);
  const serverFiles = allServerFiles.filter((file) => !file.endsWith(".map"));
  if (!serverFiles.includes(path.join(output.server, MAIN_MODULE))) {
    throw new Error("worker_entry_missing_index_js");
  }
  const cssFiles = serverFiles.filter((file) => path.extname(file) === ".css");
  const [code] = await Promise.all([
    workerModules(
      output.server,
      serverFiles.filter((file) => path.extname(file) !== ".css"),
    ),
    assertServerCssPublished(output, cssFiles, clientFiles),
  ]);
  await assertWorkerEntryNotEmpty(output.server);
  return { code, sourceMaps: await sourceMapModules(output.server, allServerFiles, code) };
}

async function sha256Hex(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  return Buffer.from(await crypto.subtle.digest("SHA-256", encoded)).toString("hex");
}

async function clientDigest(client: string, clientFiles: readonly string[]): Promise<string> {
  const manifest = await Promise.all(
    clientFiles.map(async (file) => [path.relative(client, file), await fileSha256(file)]),
  );
  return sha256Hex(manifest);
}

async function releaseId(codeModules: readonly WorkerModule[], digest: string): Promise<string> {
  const hash = await sha256Hex([
    codeModules.map((module) => [module.name, module.contentSha256]),
    digest,
  ]);
  return hash.slice(0, RELEASE_LENGTH);
}

async function assertExistingStagedCopy(
  source: string,
  destination: string,
  cause: Readonly<Error>,
): Promise<void> {
  const existing = await lstat(destination);
  if (!existing.isFile() || existing.nlink !== 1) {
    throw new Error("artifact_staging_link_forbidden", { cause });
  }
  if (!(await sameContent(source, destination))) {
    throw new Error("artifact_staging_contaminated", { cause });
  }
}

async function stageFile(source: string, destination: string): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  await assertRealDirectory(path.dirname(destination), "artifact_staging_symlink_forbidden");
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error: unknown) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
      throw error;
    }
    await assertExistingStagedCopy(source, destination, error);
  }
}

async function stageClientFiles(
  client: string,
  staging: string,
  clientFiles: readonly string[],
): Promise<void> {
  await mkdir(staging, { recursive: true });
  await assertRealDirectory(staging, "artifact_staging_symlink_forbidden");
  await Promise.all(
    clientFiles.map(async (source) => {
      await stageFile(source, path.join(staging, path.relative(client, source)));
    }),
  );
  const stagedFiles = await files(staging);
  if (
    stagedFiles.length !== clientFiles.length ||
    stagedFiles.some(
      (file) => !clientFiles.includes(path.join(client, path.relative(staging, file))),
    )
  ) {
    throw new Error("artifact_staging_contaminated");
  }
}

async function loadArtifacts(repositoryRoot: string, target: Application): Promise<Artifacts> {
  const root = path.join(repositoryRoot, "apps", target, "dist");
  const output = { client: path.join(root, "client"), server: path.join(root, "server") };
  await Promise.all(
    [root, output.server, output.client].map(async (directory) => {
      await assertRealDirectory(directory, "artifact_directory_symlink_forbidden");
    }),
  );
  const clientFiles = await clientArtifactFiles(output.client);
  const { code, sourceMaps } = await loadWorkerModules(output, clientFiles);
  const digest = await clientDigest(output.client, clientFiles);
  const release = await releaseId(code, digest);
  const staging = path.join(repositoryRoot, "infra", "cloudflare", ".artifacts", target, digest);
  await stageClientFiles(output.client, staging, clientFiles);
  return {
    clientDirectory: staging,
    mainModule: MAIN_MODULE,
    modules: [...code, ...sourceMaps],
    release,
  };
}

export { loadArtifacts };
