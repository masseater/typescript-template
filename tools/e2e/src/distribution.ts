import { httpStatus, requestTimeout } from "./http.ts";
import { ensure } from "./support.ts";
import { verifyArtifacts } from "./artifacts.ts";

const adminClientMarker = "ユーザー管理";
const explorerPaths = [
  "/cdn-cgi/explorer/api/d1/database",
  "/cdn-cgi/local/explorer/api/d1/database",
];

async function get(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(requestTimeout.short) });
}

function assetPath(file: string): string {
  return `/${file
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

async function verifyPrivateAsset(
  origins: Readonly<{ admin: string; user: string }>,
  file: string,
  content: Readonly<Buffer>,
): Promise<void> {
  const pathname = assetPath(file);
  const [denied, absent] = await Promise.all([
    get(`${origins.admin}${pathname}`),
    get(`${origins.user}${pathname}`),
  ]);
  ensure(denied.status === httpStatus.unauthorized, "E2E_ADMIN_ASSET_BYPASSES_GATE");
  const served = Buffer.from(await absent.arrayBuffer());
  ensure(!served.equals(content), "E2E_ADMIN_ASSET_SERVED_BY_USER");
}

async function verifyExplorerHidden(url: string): Promise<void> {
  const explorer = await get(url);
  const body = await explorer.text();
  ensure(!explorer.ok && !body.includes("uuid"), "E2E_LOCAL_EXPLORER_EXPOSED");
}

export async function verifyDistribution(userOrigin: string, adminOrigin: string): Promise<void> {
  const { user, admin } = await verifyArtifacts();
  const privateAssets = [...admin.client].filter(
    ([file, content]) =>
      !user.client.has(file) &&
      file.endsWith(".js") &&
      content.toString("utf-8").includes(adminClientMarker),
  );
  ensure(privateAssets.length > 0, "E2E_ADMIN_CLIENT_MARKER_MISSING");
  const origins = { admin: adminOrigin, user: userOrigin };
  const adminRoute = await get(`${userOrigin}/api/users`);
  ensure(adminRoute.status === httpStatus.notFound, "E2E_ADMIN_ROUTE_EXPOSED_BY_USER");
  await Promise.all([
    ...privateAssets.map(async ([file, content]) => verifyPrivateAsset(origins, file, content)),
    ...[userOrigin, adminOrigin].flatMap((origin) =>
      explorerPaths.map(async (pathname) => verifyExplorerHidden(`${origin}${pathname}`)),
    ),
  ]);
}
