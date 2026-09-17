import { ensure, object } from "./support.ts";
import { parseEnv } from "node:util";

type Artifact = Readonly<Buffer>;
type ArtifactFiles = ReadonlyMap<string, Artifact>;

interface Build {
  readonly client: ArtifactFiles;
  readonly directory: string;
  readonly entry: string;
  readonly name: string;
  readonly server: ArtifactFiles;
  readonly workerFirst: boolean;
}

interface ArtifactPair {
  readonly admin: Build;
  readonly secrets: readonly string[];
  readonly user: Build;
  readonly wiki: Build;
}

const adminClientMarker = "ユーザー管理";
const adminMarkers = ["ADMIN_STRONG_SESSION_REQUIRED", "LOCAL_ADMIN_PASSWORD"];
const adminRoute = /["'`]\/api\/users(?:["'`?])/u;
const adminSource = /(?:^|\/)apps\/admin\/|(?:^|\/)libs\/db\/src\/admin\.ts$/u;
const applicationAuthRoute = /["'`]\/api\/auth\//u;
const browserEntry = /^assets\/(?:index|client|entry)[^/]*\.(?:m?js)$/u;
const executableOrDocument = /\.(?:m?js|html)$/u;
const privateKey = /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/u;
const privatePublicFile =
  /(?:\.map(?:\.(?:gz|br))?$|^\.(?:dev\.vars|env)(?:\.|$)|^\.(?:git|local|wrangler)$|^wrangler\.(?:jsonc?|toml)$|\.(?:sqlite3?|db|pem|key)$)/iu;
const privateWikiSource = /(?:^|\/)(?:apps\/(?:user|admin)|libs\/(?:db|auth|ui))\//u;
const secretName = /SECRET|PASSWORD|TOKEN|PRIVATE_KEY|API_KEY|OTEL_EXPORTER_OTLP_HEADERS/iu;
const sourceMapReference = /(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/u;
const wikiMarker = "@cf/baai/bge-m3";

function parseJson(buffer: Artifact): Record<string, unknown> {
  try {
    return object(JSON.parse(buffer.toString("utf-8")) as unknown);
  } catch {
    throw new Error("E2E_ARTIFACT_INVALID_JSON");
  }
}

function secretValues(source: string): string[] {
  return Object.entries(parseEnv(source)).flatMap(([key, value]) =>
    value !== undefined && value.length > 0 && secretName.test(key) ? [value] : [],
  );
}

function assertBuildEntries(build: Build): void {
  ensure(build.workerFirst, "E2E_ARTIFACT_WORKER_GATE_BYPASSED");
  ensure((build.server.get(build.entry)?.length ?? 0) > 0, "E2E_ARTIFACT_WORKER_ENTRY_MISSING");
  ensure(
    [...build.client.keys()].some((file) => browserEntry.test(file)),
    "E2E_ARTIFACT_BROWSER_ENTRY_MISSING",
  );
  ensure(
    [...build.client.values()].some((content) => content.length > 0),
    "E2E_ARTIFACT_BROWSER_BUILD_EMPTY",
  );
}

function assertEntries(pair: ArtifactPair): void {
  const builds = [pair.user, pair.admin, pair.wiki];
  ensure(
    new Set(builds.map((build) => build.name)).size === builds.length &&
      new Set(builds.map((build) => build.directory)).size === builds.length,
    "E2E_ARTIFACT_WORKERS_NOT_SEPARATE",
  );
  for (const build of builds) {
    assertBuildEntries(build);
  }
  const userEntry = pair.user.server.get(pair.user.entry);
  const adminEntry = pair.admin.server.get(pair.admin.entry) ?? Buffer.alloc(0);
  ensure(userEntry?.equals(adminEntry) !== true, "E2E_ARTIFACT_IDENTICAL_WORKER_ENTRIES");
}

function code(files: ArtifactFiles): string {
  return [...files]
    .filter(([file]) => executableOrDocument.test(file))
    .map(([, bytes]) => bytes.toString("utf-8"))
    .join("\n");
}

function mappedSources(files: ArtifactFiles): unknown[] {
  return [...files]
    .filter(([file]) => file.endsWith(".map"))
    .flatMap(([, bytes]) => {
      const { sources } = parseJson(bytes);
      ensure(Array.isArray(sources), "E2E_ARTIFACT_INVALID_SERVER_MAP");
      const entries: unknown[] = sources;
      return entries;
    });
}

function mapsSource(files: ArtifactFiles, pattern: Readonly<RegExp>): boolean {
  return mappedSources(files).some((source) => typeof source === "string" && pattern.test(source));
}

function assertAdminSeparation(pair: ArtifactPair): void {
  const adminServer = code(pair.admin.server);
  const userClient = code(pair.user.client);
  const userCode = `${code(pair.user.server)}\n${userClient}`;
  ensure(code(pair.admin.client).includes(adminClientMarker), "E2E_ADMIN_CLIENT_MARKER_MISSING");
  ensure(!userClient.includes(adminClientMarker), "E2E_ADMIN_UI_IN_USER_BUNDLE");
  ensure(adminRoute.test(adminServer), "E2E_ADMIN_ROUTE_MARKER_MISSING");
  ensure(!adminRoute.test(userCode), "E2E_ADMIN_ROUTE_IN_USER_BUNDLE");
  ensure(
    adminMarkers.every((marker) => adminServer.includes(marker)),
    "E2E_ADMIN_SERVER_MARKER_MISSING",
  );
  ensure(
    !adminMarkers.some((marker) => userCode.includes(marker)),
    "E2E_ADMIN_CODE_IN_USER_BUNDLE",
  );
  ensure(!mapsSource(pair.user.server, adminSource), "E2E_ADMIN_SOURCE_IN_USER_SERVER_MAP");
}

function assertWikiSeparation(pair: ArtifactPair): void {
  const wikiServer = code(pair.wiki.server);
  const wikiCode = `${wikiServer}\n${code(pair.wiki.client)}`;
  ensure(wikiServer.includes(wikiMarker), "E2E_WIKI_SERVER_MARKER_MISSING");
  ensure(
    !code(pair.admin.server).includes(wikiMarker) && !code(pair.user.server).includes(wikiMarker),
    "E2E_WIKI_CODE_IN_APPLICATION_BUNDLE",
  );
  ensure(
    !adminRoute.test(wikiCode) &&
      !wikiCode.includes(adminClientMarker) &&
      !adminMarkers.some((marker) => wikiCode.includes(marker)) &&
      !applicationAuthRoute.test(wikiCode),
    "E2E_APPLICATION_CODE_IN_WIKI_BUNDLE",
  );
  ensure(
    !mapsSource(pair.wiki.server, privateWikiSource),
    "E2E_APPLICATION_SOURCE_IN_WIKI_SERVER_MAP",
  );
}

function assertSeparation(pair: ArtifactPair): void {
  assertAdminSeparation(pair);
  assertWikiSeparation(pair);
}

function assertPublicFile(filename: string, bytes: Artifact, secrets: readonly string[]): void {
  const segments = filename.replaceAll("\\", "/").split("/");
  ensure(
    !segments.some((segment) => privatePublicFile.test(segment)),
    "E2E_ARTIFACT_PRIVATE_FILE_IN_PUBLIC_DIRECTORY",
  );
  const text = bytes.toString("utf-8");
  ensure(!sourceMapReference.test(text), "E2E_ARTIFACT_PUBLIC_SOURCEMAP_REFERENCE");
  ensure(!privateKey.test(text), "E2E_ARTIFACT_PRIVATE_KEY_IN_PUBLIC_BUNDLE");
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

function assertPublicSafety(pair: ArtifactPair): void {
  for (const build of [pair.user, pair.admin, pair.wiki]) {
    for (const [filename, bytes] of build.client) {
      assertPublicFile(filename, bytes, pair.secrets);
    }
  }
}

export {
  assertEntries,
  assertPublicFile,
  assertPublicSafety,
  assertSeparation,
  parseJson,
  secretValues,
};
export type { ArtifactFiles, ArtifactPair, Build };
