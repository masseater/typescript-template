import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { parseEnv } from "node:util";
import path from "node:path";
import { ensure, object, root, string, safeFailure } from "./support.ts";

type Build = {
  name: string;
  directory: string;
  entry: string;
  workerFirst: boolean;
  client: Map<string, Buffer>;
  server: Map<string, Buffer>;
};
export type ArtifactPair = { user: Build; admin: Build; wiki: Build; secrets: readonly string[] };
const adminMarkers = ["ADMIN_STRONG_SESSION_REQUIRED", "LOCAL_ADMIN_PASSWORD"];
const adminRoute = /["'`]\/api\/users(?:["'`?])/;
const wikiMarker = "WIKI_SEMANTIC_ASSET_UNAVAILABLE";
const privateWikiSource = /(?:^|\/)(?:apps\/(?:user|admin)|libs\/(?:db|auth|ui))\//;

async function readFiles(directory: string): Promise<Map<string, Buffer>> {
  const entries = new Map<string, Buffer>();
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      ensure(!entry.isSymbolicLink(), "E2E_ARTIFACT_SYMLINK_FORBIDDEN");
      const filename = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile())
        entries.set(
          path.relative(directory, filename).split(path.sep).join("/"),
          await readFile(filename),
        );
      else throw new Error("E2E_ARTIFACT_SPECIAL_FILE_FORBIDDEN");
    }
  }
  await walk(directory);
  return entries;
}

function parseJson(buffer: Buffer): Record<string, unknown> {
  try {
    return object(JSON.parse(buffer.toString("utf8")) as unknown);
  } catch {
    throw new Error("E2E_ARTIFACT_INVALID_JSON");
  }
}

async function readBuild(audience: "user" | "admin" | "wiki"): Promise<Build> {
  const expected = path.join(root, "apps", audience, "dist");
  const directory = await realpath(expected);
  ensure(directory === expected, "E2E_ARTIFACT_BUILD_PATH_ALIAS");
  const serverDirectory = path.join(directory, "server");
  const clientDirectory = path.join(directory, "client");
  ensure(
    (await realpath(serverDirectory)) === serverDirectory &&
      (await realpath(clientDirectory)) === clientDirectory,
    "E2E_ARTIFACT_OUTPUT_PATH_ALIAS",
  );
  const [server, client] = await Promise.all([
    readFiles(serverDirectory),
    readFiles(clientDirectory),
  ]);
  const configBytes = server.get("wrangler.json");
  ensure(configBytes, "E2E_ARTIFACT_WORKER_CONFIG_MISSING");
  const config = parseJson(configBytes);
  const assets = object(config["assets"]);
  ensure(
    path.resolve(serverDirectory, string(assets["directory"])) === clientDirectory,
    "E2E_ARTIFACT_ASSETS_DIRECTORY_UNSAFE",
  );
  ensure(assets["binding"] === "ASSETS", "E2E_ARTIFACT_ASSET_BINDING_MISSING");
  const entry = path
    .relative(serverDirectory, path.resolve(serverDirectory, string(config["main"])))
    .split(path.sep)
    .join("/");
  ensure(!entry.startsWith("../") && /\.(?:m?js)$/.test(entry), "E2E_ARTIFACT_WORKER_ENTRY_UNSAFE");
  return {
    name: string(config["name"]),
    directory,
    entry,
    workerFirst: assets["run_worker_first"] === true,
    server,
    client,
  };
}

export function secretValues(source: string): string[] {
  return Object.entries(parseEnv(source)).flatMap(([key, value]) =>
    value && /SECRET|PASSWORD|TOKEN|PRIVATE_KEY|API_KEY|OTEL_EXPORTER_OTLP_HEADERS/i.test(key)
      ? [value]
      : [],
  );
}

async function localSecrets(): Promise<string[]> {
  const found = new Set<string>();
  async function inspect(directory: string, recursive: boolean) {
    const information = await lstat(directory).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
        return undefined;
      throw new Error("E2E_ARTIFACT_SECRET_INPUT_UNREADABLE");
    });
    if (!information) return;
    ensure(!information.isSymbolicLink(), "E2E_ARTIFACT_SECRET_DIRECTORY_ALIAS");
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory() && recursive) await inspect(filename, true);
      if (!/(?:^\.dev\.vars(?:\.|$)|(?:^|\.)env(?:\.|$))/.test(entry.name)) continue;
      const resolved = await realpath(filename);
      ensure(
        resolved.startsWith(`${root.replace(/\/$/, "")}${path.sep}`),
        "E2E_ARTIFACT_SECRET_INPUT_OUTSIDE_REPOSITORY",
      );
      if ((await lstat(resolved)).isFile())
        for (const value of secretValues(await readFile(resolved, "utf8"))) found.add(value);
    }
  }
  await inspect(root, false);
  for (const audience of ["user", "admin", "wiki"]) {
    await inspect(path.join(root, "apps", audience), false);
    await inspect(path.join(root, "apps", audience, "dist/server"), false);
  }
  await inspect(path.join(root, ".local"), true);
  return [...found];
}

export async function loadArtifacts(): Promise<ArtifactPair> {
  try {
    const [user, admin, wiki, secrets] = await Promise.all([
      readBuild("user"),
      readBuild("admin"),
      readBuild("wiki"),
      localSecrets(),
    ]);
    return { user, admin, wiki, secrets };
  } catch (error) {
    throw safeFailure(error, "artifact-loading");
  }
}

export function assertEntries(pair: ArtifactPair): void {
  const builds = [pair.user, pair.admin, pair.wiki];
  ensure(
    new Set(builds.map((build) => build.name)).size === builds.length &&
      new Set(builds.map((build) => build.directory)).size === builds.length,
    "E2E_ARTIFACT_WORKERS_NOT_SEPARATE",
  );
  for (const build of builds) {
    ensure(build.workerFirst, "E2E_ARTIFACT_WORKER_GATE_BYPASSED");
    ensure((build.server.get(build.entry)?.length ?? 0) > 0, "E2E_ARTIFACT_WORKER_ENTRY_MISSING");
    ensure(
      [...build.client.keys()].some((file) =>
        /^assets\/(?:index|client|entry)[^/]*\.(?:m?js)$/.test(file),
      ),
      "E2E_ARTIFACT_BROWSER_ENTRY_MISSING",
    );
    ensure(
      [...build.client.values()].some((content) => content.length > 0),
      "E2E_ARTIFACT_BROWSER_BUILD_EMPTY",
    );
  }
  ensure(
    !pair.user.server
      .get(pair.user.entry)
      ?.equals(pair.admin.server.get(pair.admin.entry) ?? Buffer.alloc(0)),
    "E2E_ARTIFACT_IDENTICAL_WORKER_ENTRIES",
  );
}

function code(files: ReadonlyMap<string, Buffer>): string {
  return [...files]
    .filter(([file]) => /\.(?:m?js|html)$/.test(file))
    .map(([, bytes]) => bytes.toString("utf8"))
    .join("\n");
}

export function assertSeparation(pair: ArtifactPair): void {
  const adminServer = code(pair.admin.server);
  const userServer = code(pair.user.server);
  const adminClient = code(pair.admin.client);
  const userClient = code(pair.user.client);
  ensure(adminClient.includes("ユーザー管理"), "E2E_ADMIN_CLIENT_MARKER_MISSING");
  ensure(!userClient.includes("ユーザー管理"), "E2E_ADMIN_UI_IN_USER_BUNDLE");
  ensure(adminRoute.test(adminServer), "E2E_ADMIN_ROUTE_MARKER_MISSING");
  ensure(
    !adminRoute.test(userServer) && !adminRoute.test(userClient),
    "E2E_ADMIN_ROUTE_IN_USER_BUNDLE",
  );
  for (const marker of adminMarkers) {
    ensure(adminServer.includes(marker), "E2E_ADMIN_SERVER_MARKER_MISSING");
    ensure(
      !userServer.includes(marker) && !userClient.includes(marker),
      "E2E_ADMIN_CODE_IN_USER_BUNDLE",
    );
  }
  for (const [file, bytes] of pair.user.server) {
    if (!file.endsWith(".map")) continue;
    const sources = parseJson(bytes)["sources"];
    ensure(Array.isArray(sources), "E2E_ARTIFACT_INVALID_SERVER_MAP");
    ensure(
      !sources.some(
        (source: unknown) =>
          typeof source === "string" &&
          /(?:^|\/)apps\/admin\/|(?:^|\/)libs\/db\/src\/admin\.ts$/.test(source),
      ),
      "E2E_ADMIN_SOURCE_IN_USER_SERVER_MAP",
    );
  }
  const wikiServer = code(pair.wiki.server);
  const wikiCode = `${wikiServer}\n${code(pair.wiki.client)}`;
  ensure(wikiServer.includes(wikiMarker), "E2E_WIKI_SERVER_MARKER_MISSING");
  ensure(
    !adminServer.includes(wikiMarker) && !userServer.includes(wikiMarker),
    "E2E_WIKI_CODE_IN_APPLICATION_BUNDLE",
  );
  ensure(
    !adminRoute.test(wikiCode) &&
      !wikiCode.includes("ユーザー管理") &&
      !adminMarkers.some((marker) => wikiCode.includes(marker)) &&
      !/["'`]\/api\/auth\//.test(wikiCode),
    "E2E_APPLICATION_CODE_IN_WIKI_BUNDLE",
  );
  for (const [file, bytes] of pair.wiki.server) {
    if (!file.endsWith(".map")) continue;
    const sources = parseJson(bytes)["sources"];
    ensure(Array.isArray(sources), "E2E_ARTIFACT_INVALID_SERVER_MAP");
    ensure(
      !sources.some(
        (source: unknown) => typeof source === "string" && privateWikiSource.test(source),
      ),
      "E2E_APPLICATION_SOURCE_IN_WIKI_SERVER_MAP",
    );
  }
}

export function assertPublicFile(
  filename: string,
  bytes: Buffer,
  secrets: readonly string[],
): void {
  const segments = filename.replaceAll("\\", "/").split("/");
  ensure(
    !segments.some((segment) =>
      /(?:\.map(?:\.(?:gz|br))?$|^\.(?:dev\.vars|env)(?:\.|$)|^\.(?:git|local|wrangler)$|^wrangler\.(?:jsonc?|toml)$|\.(?:sqlite3?|db|pem|key)$)/i.test(
        segment,
      ),
    ),
    "E2E_ARTIFACT_PRIVATE_FILE_IN_PUBLIC_DIRECTORY",
  );
  const text = bytes.toString("utf8");
  ensure(
    !/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/.test(text),
    "E2E_ARTIFACT_PUBLIC_SOURCEMAP_REFERENCE",
  );
  ensure(
    !/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(text),
    "E2E_ARTIFACT_PRIVATE_KEY_IN_PUBLIC_BUNDLE",
  );
  for (const secret of secrets) {
    const encodings = [
      secret,
      JSON.stringify(secret).slice(1, -1),
      encodeURIComponent(secret),
      Buffer.from(secret).toString("base64"),
    ];
    ensure(
      !encodings.some((value) => value.length > 0 && text.includes(value)),
      "E2E_ARTIFACT_LOCAL_SECRET_IN_PUBLIC_BUNDLE",
    );
  }
}

export function assertPublicSafety(pair: ArtifactPair): void {
  for (const build of [pair.user, pair.admin, pair.wiki])
    for (const [filename, bytes] of build.client) assertPublicFile(filename, bytes, pair.secrets);
}

export async function verifyArtifacts(): Promise<ArtifactPair> {
  const pair = await loadArtifacts();
  assertEntries(pair);
  assertSeparation(pair);
  assertPublicSafety(pair);
  return pair;
}
