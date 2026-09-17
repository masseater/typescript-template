import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import type { Stats } from "node:fs";
import { parseEnv } from "node:util";
import path from "node:path";
import { Cause, Effect } from "effect";
import { E2eFailure, ensure, fail, object, parseJson, root, staged, string } from "./support.ts";

type Build = {
  name: string;
  directory: string;
  entry: string;
  workerFirst: boolean;
  client: Map<string, Buffer>;
  server: Map<string, Buffer>;
};
export type ArtifactPair = { user: Build; admin: Build; wiki: Build; secrets: readonly string[] };
const adminMarkers = ["AdminStrongSessionRequired", "LOCAL_ADMIN_PASSWORD"];
const adminRoute = /["'`]\/api\/users(?:["'`?])/;
const wikiMarker = "@cf/baai/bge-m3";
const privateWikiSource = /(?:^|\/)(?:apps\/(?:user|admin)|libs\/(?:db|auth|ui))\//;

const readFiles = Effect.fn("readFiles")(function* (directory: string) {
  const entries = new Map<string, Buffer>();
  const walk = (current: string): Effect.Effect<void, E2eFailure | Cause.UnknownError> =>
    Effect.gen(function* () {
      for (const entry of yield* Effect.tryPromise(() =>
        readdir(current, { withFileTypes: true }),
      )) {
        yield* ensure(!entry.isSymbolicLink(), "E2E_ARTIFACT_SYMLINK_FORBIDDEN");
        const filename = path.join(current, entry.name);
        if (entry.isDirectory()) yield* walk(filename);
        else if (entry.isFile())
          entries.set(
            path.relative(directory, filename).split(path.sep).join("/"),
            yield* Effect.tryPromise(() => readFile(filename)),
          );
        else return yield* fail("E2E_ARTIFACT_SPECIAL_FILE_FORBIDDEN");
      }
    });
  yield* walk(directory);
  return entries;
});

const jsonRecord = (buffer: Buffer) =>
  parseJson(buffer.toString("utf8"), "E2E_ARTIFACT_INVALID_JSON").pipe(
    Effect.flatMap(object),
    Effect.mapError(() => new E2eFailure({ code: "E2E_ARTIFACT_INVALID_JSON" })),
  );

const readBuild = Effect.fn("readBuild")(function* (audience: "user" | "admin" | "wiki") {
  const expected = path.join(root, "apps", audience, "dist");
  const directory = yield* Effect.tryPromise(() => realpath(expected));
  yield* ensure(directory === expected, "E2E_ARTIFACT_BUILD_PATH_ALIAS");
  const serverDirectory = path.join(directory, "server");
  const clientDirectory = path.join(directory, "client");
  yield* ensure(
    (yield* Effect.tryPromise(() => realpath(serverDirectory))) === serverDirectory &&
      (yield* Effect.tryPromise(() => realpath(clientDirectory))) === clientDirectory,
    "E2E_ARTIFACT_OUTPUT_PATH_ALIAS",
  );
  const [server, client] = yield* Effect.all(
    [readFiles(serverDirectory), readFiles(clientDirectory)],
    { concurrency: "unbounded" },
  );
  const configBytes = server.get("wrangler.json");
  if (!configBytes) return yield* fail("E2E_ARTIFACT_WORKER_CONFIG_MISSING");
  const config = yield* jsonRecord(configBytes);
  const assets = yield* object(config["assets"]);
  yield* ensure(
    path.resolve(serverDirectory, yield* string(assets["directory"])) === clientDirectory,
    "E2E_ARTIFACT_ASSETS_DIRECTORY_UNSAFE",
  );
  yield* ensure(assets["binding"] === "ASSETS", "E2E_ARTIFACT_ASSET_BINDING_MISSING");
  const entry = path
    .relative(serverDirectory, path.resolve(serverDirectory, yield* string(config["main"])))
    .split(path.sep)
    .join("/");
  yield* ensure(
    !entry.startsWith("../") && /\.(?:m?js)$/.test(entry),
    "E2E_ARTIFACT_WORKER_ENTRY_UNSAFE",
  );
  return {
    name: yield* string(config["name"]),
    directory,
    entry,
    workerFirst: assets["run_worker_first"] === true,
    server,
    client,
  };
});

export function secretValues(source: string): string[] {
  return Object.entries(parseEnv(source)).flatMap(([key, value]) =>
    value && /SECRET|PASSWORD|TOKEN|PRIVATE_KEY|API_KEY/i.test(key) ? [value] : [],
  );
}

const missing = (error: unknown) =>
  error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";

const localSecrets = Effect.fn("localSecrets")(function* () {
  const found = new Set<string>();
  const inspect = (
    directory: string,
    recursive: boolean,
  ): Effect.Effect<void, E2eFailure | Cause.UnknownError> =>
    Effect.gen(function* () {
      const information = yield* Effect.tryPromise({
        try: () =>
          lstat(directory).then(
            (stats): Stats | undefined => stats,
            (error: unknown) => (missing(error) ? undefined : Promise.reject(error)),
          ),
        catch: () => new E2eFailure({ code: "E2E_ARTIFACT_SECRET_INPUT_UNREADABLE" }),
      });
      if (!information) return;
      yield* ensure(!information.isSymbolicLink(), "E2E_ARTIFACT_SECRET_DIRECTORY_ALIAS");
      for (const entry of yield* Effect.tryPromise(() =>
        readdir(directory, { withFileTypes: true }),
      )) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory() && recursive) yield* inspect(filename, true);
        if (!/(?:^\.dev\.vars(?:\.|$)|(?:^|\.)env(?:\.|$))/.test(entry.name)) continue;
        const resolved = yield* Effect.tryPromise(() => realpath(filename));
        yield* ensure(
          resolved.startsWith(`${root.replace(/\/$/, "")}${path.sep}`),
          "E2E_ARTIFACT_SECRET_INPUT_OUTSIDE_REPOSITORY",
        );
        if ((yield* Effect.tryPromise(() => lstat(resolved))).isFile())
          for (const value of secretValues(
            yield* Effect.tryPromise(() => readFile(resolved, "utf8")),
          ))
            found.add(value);
      }
    });
  yield* inspect(root, false);
  for (const audience of ["user", "admin", "wiki"]) {
    yield* inspect(path.join(root, "apps", audience), false);
    yield* inspect(path.join(root, "apps", audience, "dist/server"), false);
  }
  yield* inspect(path.join(root, ".local"), true);
  return [...found];
});

export const loadArtifacts = Effect.fn("loadArtifacts")(function* () {
  const [user, admin, wiki, secrets] = yield* Effect.all(
    [readBuild("user"), readBuild("admin"), readBuild("wiki"), localSecrets()],
    { concurrency: "unbounded" },
  ).pipe(staged(() => "artifact-loading"));
  return { user, admin, wiki, secrets } satisfies ArtifactPair;
});

export const assertEntries = Effect.fn("assertEntries")(function* (pair: ArtifactPair) {
  const builds = [pair.user, pair.admin, pair.wiki];
  yield* ensure(
    new Set(builds.map((build) => build.name)).size === builds.length &&
      new Set(builds.map((build) => build.directory)).size === builds.length,
    "E2E_ARTIFACT_WORKERS_NOT_SEPARATE",
  );
  for (const build of builds) {
    yield* ensure(build.workerFirst, "E2E_ARTIFACT_WORKER_GATE_BYPASSED");
    yield* ensure(
      (build.server.get(build.entry)?.length ?? 0) > 0,
      "E2E_ARTIFACT_WORKER_ENTRY_MISSING",
    );
    yield* ensure(
      [...build.client.keys()].some((file) =>
        /^assets\/(?:index|client|entry)[^/]*\.(?:m?js)$/.test(file),
      ),
      "E2E_ARTIFACT_BROWSER_ENTRY_MISSING",
    );
    yield* ensure(
      [...build.client.values()].some((content) => content.length > 0),
      "E2E_ARTIFACT_BROWSER_BUILD_EMPTY",
    );
  }
  yield* ensure(
    !pair.user.server
      .get(pair.user.entry)
      ?.equals(pair.admin.server.get(pair.admin.entry) ?? Buffer.alloc(0)),
    "E2E_ARTIFACT_IDENTICAL_WORKER_ENTRIES",
  );
});

function code(files: ReadonlyMap<string, Buffer>): string {
  return [...files]
    .filter(([file]) => /\.(?:m?js|html)$/.test(file))
    .map(([, bytes]) => bytes.toString("utf8"))
    .join("\n");
}

const mapSources = Effect.fn("mapSources")(function* (
  files: ReadonlyMap<string, Buffer>,
  forbidden: (source: string) => boolean,
  failureCode: string,
) {
  for (const [file, bytes] of files) {
    if (!file.endsWith(".map")) continue;
    const sources = (yield* jsonRecord(bytes))["sources"];
    if (!Array.isArray(sources)) return yield* fail("E2E_ARTIFACT_INVALID_SERVER_MAP");
    yield* ensure(
      !sources.some((source: unknown) => typeof source === "string" && forbidden(source)),
      failureCode,
    );
  }
});

export const assertSeparation = Effect.fn("assertSeparation")(function* (pair: ArtifactPair) {
  const adminServer = code(pair.admin.server);
  const userServer = code(pair.user.server);
  const adminClient = code(pair.admin.client);
  const userClient = code(pair.user.client);
  yield* ensure(adminClient.includes("ユーザー管理"), "E2E_ADMIN_CLIENT_MARKER_MISSING");
  yield* ensure(!userClient.includes("ユーザー管理"), "E2E_ADMIN_UI_IN_USER_BUNDLE");
  yield* ensure(adminRoute.test(adminServer), "E2E_ADMIN_ROUTE_MARKER_MISSING");
  yield* ensure(
    !adminRoute.test(userServer) && !adminRoute.test(userClient),
    "E2E_ADMIN_ROUTE_IN_USER_BUNDLE",
  );
  for (const marker of adminMarkers) {
    yield* ensure(adminServer.includes(marker), "E2E_ADMIN_SERVER_MARKER_MISSING");
    yield* ensure(
      !userServer.includes(marker) && !userClient.includes(marker),
      "E2E_ADMIN_CODE_IN_USER_BUNDLE",
    );
  }
  yield* mapSources(
    pair.user.server,
    (source) => /(?:^|\/)apps\/admin\/|(?:^|\/)libs\/db\/src\/admin\.ts$/.test(source),
    "E2E_ADMIN_SOURCE_IN_USER_SERVER_MAP",
  );
  const wikiServer = code(pair.wiki.server);
  const wikiCode = `${wikiServer}\n${code(pair.wiki.client)}`;
  yield* ensure(wikiServer.includes(wikiMarker), "E2E_WIKI_SERVER_MARKER_MISSING");
  yield* ensure(
    !adminServer.includes(wikiMarker) && !userServer.includes(wikiMarker),
    "E2E_WIKI_CODE_IN_APPLICATION_BUNDLE",
  );
  yield* ensure(
    !adminRoute.test(wikiCode) &&
      !wikiCode.includes("ユーザー管理") &&
      !adminMarkers.some((marker) => wikiCode.includes(marker)) &&
      !/["'`]\/api\/auth\//.test(wikiCode),
    "E2E_APPLICATION_CODE_IN_WIKI_BUNDLE",
  );
  yield* mapSources(
    pair.wiki.server,
    (source) => privateWikiSource.test(source),
    "E2E_APPLICATION_SOURCE_IN_WIKI_SERVER_MAP",
  );
});

export const assertPublicFile = Effect.fn("assertPublicFile")(function* (
  filename: string,
  bytes: Buffer,
  secrets: readonly string[],
) {
  const segments = filename.replaceAll("\\", "/").split("/");
  yield* ensure(
    !segments.some((segment) =>
      /(?:\.map(?:\.(?:gz|br))?$|^\.(?:dev\.vars|env)(?:\.|$)|^\.(?:git|local|wrangler)$|^wrangler\.(?:jsonc?|toml)$|\.(?:sqlite3?|db|pem|key)$)/i.test(
        segment,
      ),
    ),
    "E2E_ARTIFACT_PRIVATE_FILE_IN_PUBLIC_DIRECTORY",
  );
  const text = bytes.toString("utf8");
  yield* ensure(
    !/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/.test(text),
    "E2E_ARTIFACT_PUBLIC_SOURCEMAP_REFERENCE",
  );
  yield* ensure(
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
    yield* ensure(
      !encodings.some((value) => value.length > 0 && text.includes(value)),
      "E2E_ARTIFACT_LOCAL_SECRET_IN_PUBLIC_BUNDLE",
    );
  }
});

export const assertPublicSafety = Effect.fn("assertPublicSafety")(function* (pair: ArtifactPair) {
  for (const build of [pair.user, pair.admin, pair.wiki])
    for (const [filename, bytes] of build.client)
      yield* assertPublicFile(filename, bytes, pair.secrets);
});

export const verifyArtifacts = Effect.fn("verifyArtifacts")(function* () {
  const pair = yield* loadArtifacts();
  yield* assertEntries(pair);
  yield* assertSeparation(pair);
  yield* assertPublicSafety(pair);
  return pair;
});
