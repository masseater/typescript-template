import type { ArtifactFiles, ArtifactPair, Build } from "./artifact-policy.ts";
import type { Dirent, Stats } from "node:fs";
import {
  assertEntries,
  assertPublicSafety,
  assertSeparation,
  parseJson,
  secretValues,
} from "./artifact-policy.ts";
import { ensure, object, root, safeFailure, string } from "./support.ts";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

type Audience = "user" | "admin" | "wiki";

const audiences: readonly Audience[] = ["user", "admin", "wiki"];
const localSecretFile = /(?:^\.dev\.vars(?:\.|$)|(?:^|\.)env(?:\.|$))/u;
const workerEntry = /\.(?:m?js)$/u;

function portablePath(directory: string, filename: string): string {
  return path.relative(directory, filename).split(path.sep).join("/");
}

async function readFiles(directory: string): Promise<ArtifactFiles> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => {
    ensure(!entry.isSymbolicLink(), "E2E_ARTIFACT_SYMLINK_FORBIDDEN");
    ensure(entry.isDirectory() || entry.isFile(), "E2E_ARTIFACT_SPECIAL_FILE_FORBIDDEN");
    return entry.isFile();
  });
  return new Map(
    await Promise.all(
      files.map(async (entry) => {
        const filename = path.join(entry.parentPath, entry.name);
        return [portablePath(directory, filename), await readFile(filename)] as const;
      }),
    ),
  );
}

async function unaliasedDirectory(expected: string, code: string): Promise<string> {
  const resolved = await realpath(expected);
  ensure(resolved === expected, code);
  return resolved;
}

function workerAssets(
  config: Readonly<Record<string, unknown>>,
  directories: Readonly<{ client: string; server: string }>,
): boolean {
  const assets = object(config["assets"]);
  ensure(
    path.resolve(directories.server, string(assets["directory"])) === directories.client,
    "E2E_ARTIFACT_ASSETS_DIRECTORY_UNSAFE",
  );
  ensure(assets["binding"] === "ASSETS", "E2E_ARTIFACT_ASSET_BINDING_MISSING");
  return assets["run_worker_first"] === true;
}

async function readBuild(audience: Audience): Promise<Build> {
  const directory = await unaliasedDirectory(
    path.join(root, "apps", audience, "dist"),
    "E2E_ARTIFACT_BUILD_PATH_ALIAS",
  );
  const [serverDirectory, clientDirectory] = await Promise.all([
    unaliasedDirectory(path.join(directory, "server"), "E2E_ARTIFACT_OUTPUT_PATH_ALIAS"),
    unaliasedDirectory(path.join(directory, "client"), "E2E_ARTIFACT_OUTPUT_PATH_ALIAS"),
  ]);
  const [server, client] = await Promise.all([
    readFiles(serverDirectory),
    readFiles(clientDirectory),
  ]);
  const configBytes = server.get("wrangler.json");
  ensure(configBytes !== undefined, "E2E_ARTIFACT_WORKER_CONFIG_MISSING");
  const config = parseJson(configBytes);
  const workerFirst = workerAssets(config, { client: clientDirectory, server: serverDirectory });
  const entry = portablePath(
    serverDirectory,
    path.resolve(serverDirectory, string(config["main"])),
  );
  ensure(!entry.startsWith("../") && workerEntry.test(entry), "E2E_ARTIFACT_WORKER_ENTRY_UNSAFE");
  return { client, directory, entry, name: string(config["name"]), server, workerFirst };
}

async function directoryInformation(directory: string): Promise<Stats | undefined> {
  try {
    return await lstat(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw new Error("E2E_ARTIFACT_SECRET_INPUT_UNREADABLE", { cause: error });
  }
}

async function secretsInFile(filename: string): Promise<string[]> {
  const resolved = await realpath(filename);
  ensure(
    resolved.startsWith(`${root.replace(/\/$/u, "")}${path.sep}`),
    "E2E_ARTIFACT_SECRET_INPUT_OUTSIDE_REPOSITORY",
  );
  const information = await lstat(resolved);
  return information.isFile() ? secretValues(await readFile(resolved, "utf-8")) : [];
}

async function secretsInDirectory(directory: string, recursive: boolean): Promise<string[]> {
  const information = await directoryInformation(directory);
  if (information === undefined) {
    return [];
  }
  ensure(!information.isSymbolicLink(), "E2E_ARTIFACT_SECRET_DIRECTORY_ALIAS");
  const entries = await readdir(directory, { recursive, withFileTypes: true });
  const found = await Promise.all(
    entries
      .filter((entry: Readonly<Dirent>) => localSecretFile.test(entry.name))
      .map(async (entry: Readonly<Dirent>) =>
        secretsInFile(path.join(entry.parentPath, entry.name)),
      ),
  );
  return found.flat();
}

async function localSecrets(): Promise<string[]> {
  const found = await Promise.all([
    secretsInDirectory(root, false),
    ...audiences.flatMap((audience) => [
      secretsInDirectory(path.join(root, "apps", audience), false),
      secretsInDirectory(path.join(root, "apps", audience, "dist/server"), false),
    ]),
    secretsInDirectory(path.join(root, ".local"), true),
  ]);
  return [...new Set(found.flat())];
}

async function loadArtifacts(): Promise<ArtifactPair> {
  try {
    const [user, admin, wiki, secrets] = await Promise.all([
      readBuild("user"),
      readBuild("admin"),
      readBuild("wiki"),
      localSecrets(),
    ]);
    return { admin, secrets, user, wiki };
  } catch (error) {
    throw safeFailure(error, "artifact-loading");
  }
}

async function verifyArtifacts(): Promise<ArtifactPair> {
  const pair = await loadArtifacts();
  assertEntries(pair);
  assertSeparation(pair);
  assertPublicSafety(pair);
  return pair;
}

export { loadArtifacts, verifyArtifacts };
