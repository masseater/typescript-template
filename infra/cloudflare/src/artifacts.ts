import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { AppTarget } from "./config.ts";

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

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isSymbolicLink()) throw new Error("artifact_symlink_forbidden");
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return files(filename);
      if (!entry.isFile()) throw new Error("artifact_file_type_invalid");
      return [filename];
    }),
  );
  return nested.flat().sort();
}

export async function loadArtifacts(repositoryRoot: string, target: AppTarget) {
  const root = path.join(repositoryRoot, "apps", target, "dist");
  const server = path.join(root, "server");
  const client = path.join(root, "client");
  for (const directory of [root, server, client]) {
    if ((await realpath(directory)) !== directory)
      throw new Error("artifact_directory_symlink_forbidden");
  }
  const allClientFiles = await files(client);
  if (allClientFiles.some((file) => privateArtifact(path.relative(client, file))))
    throw new Error("private_client_artifact");
  const clientFiles = allClientFiles.filter((file) => !file.endsWith(".map"));
  if (clientFiles.length === 0) throw new Error("client_artifacts_empty");
  const serverFiles = (await files(server)).filter(
    (file) => !file.endsWith(".map") && !privateArtifact(path.relative(server, file)),
  );
  const mainModule = "index.js";
  if (!serverFiles.includes(path.join(server, mainModule)))
    throw new Error("worker_entry_missing_index_js");
  const modules = await Promise.all(
    serverFiles.map(async (file) => {
      const extension = path.extname(file);
      if (extension === ".css") {
        const publicFile = path.join(client, path.relative(server, file));
        if (
          !clientFiles.includes(publicFile) ||
          !(await readFile(file)).equals(await readFile(publicFile))
        )
          throw new Error("server_css_without_public_asset");
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
      if (!contentType) throw new Error("worker_module_type_unsupported");
      return {
        name: path.relative(server, file).replaceAll(path.sep, "/"),
        contentFile: file,
        contentSha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
        contentType,
      };
    }),
  );
  if ((await stat(path.join(server, mainModule))).size === 0) throw new Error("worker_entry_empty");
  const manifest = await Promise.all(
    clientFiles.map(async (file) => [
      path.relative(client, file),
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    ]),
  );
  const digest = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  const staging = path.join(repositoryRoot, "infra", "cloudflare", ".artifacts", target, digest);
  await mkdir(staging, { recursive: true });
  if ((await realpath(staging)) !== staging) throw new Error("artifact_staging_symlink_forbidden");
  for (const source of clientFiles) {
    const destination = path.join(staging, path.relative(client, source));
    await mkdir(path.dirname(destination), { recursive: true });
    if ((await realpath(path.dirname(destination))) !== path.dirname(destination))
      throw new Error("artifact_staging_symlink_forbidden");
    try {
      await copyFile(source, destination, constants.COPYFILE_EXCL);
    } catch (error: unknown) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      const existing = await lstat(destination);
      if (!existing.isFile() || existing.nlink !== 1)
        throw new Error("artifact_staging_link_forbidden", { cause: error });
      if (!(await readFile(source)).equals(await readFile(destination)))
        throw new Error("artifact_staging_contaminated", { cause: error });
    }
  }
  const stagedFiles = await files(staging);
  if (
    stagedFiles.length !== clientFiles.length ||
    stagedFiles.some(
      (file) => !clientFiles.includes(path.join(client, path.relative(staging, file))),
    )
  ) {
    throw new Error("artifact_staging_contaminated");
  }
  return {
    mainModule,
    modules: modules.filter((module) => module !== undefined),
    clientDirectory: staging,
  };
}
