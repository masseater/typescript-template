import { ensure } from "./support.ts";
import { verifyArtifacts } from "./artifacts.ts";

export async function verifyDistribution(userOrigin: string, adminOrigin: string) {
  const { user, admin } = await verifyArtifacts();
  const privateAssets = [...admin.client].filter(
    ([file, content]) =>
      !user.client.has(file) &&
      file.endsWith(".js") &&
      content.toString("utf8").includes("ユーザー管理"),
  );
  ensure(privateAssets.length > 0, "E2E_ADMIN_CLIENT_MARKER_MISSING");
  for (const [file, content] of privateAssets) {
    const pathname = `/${file.split("/").map(encodeURIComponent).join("/")}`;
    const denied = await fetch(`${adminOrigin}${pathname}`, { signal: AbortSignal.timeout(5000) });
    ensure(denied.status === 401, "E2E_ADMIN_ASSET_BYPASSES_GATE");
    const absent = await fetch(`${userOrigin}${pathname}`, { signal: AbortSignal.timeout(5000) });
    ensure(
      !Buffer.from(await absent.arrayBuffer()).equals(content),
      "E2E_ADMIN_ASSET_SERVED_BY_USER",
    );
  }
  const response = await fetch(`${userOrigin}/api/users`, { signal: AbortSignal.timeout(5000) });
  ensure(response.status === 404, "E2E_ADMIN_ROUTE_EXPOSED_BY_USER");
  for (const origin of [userOrigin, adminOrigin]) {
    for (const pathname of [
      "/cdn-cgi/explorer/api/d1/database",
      "/cdn-cgi/local/explorer/api/d1/database",
    ]) {
      const explorer = await fetch(`${origin}${pathname}`, { signal: AbortSignal.timeout(5000) });
      const body = await explorer.text();
      ensure(!explorer.ok && !body.includes("uuid"), "E2E_LOCAL_EXPLORER_EXPOSED");
    }
  }
}
