import { Effect } from "effect";
import { ensure, fetchResponse } from "./support.ts";
import { verifyArtifacts } from "./artifacts.ts";
import { verifyExplorerBoundary } from "./telemetry.ts";

export const verifyDistribution = Effect.fn("verifyDistribution")(function* (
  userOrigin: string,
  adminOrigin: string,
) {
  const { user, admin } = yield* verifyArtifacts();
  const privateAssets = [...admin.client].filter(
    ([file, content]) =>
      !user.client.has(file) &&
      file.endsWith(".js") &&
      content.toString("utf8").includes("ユーザー管理"),
  );
  yield* ensure(privateAssets.length > 0, "E2E_ADMIN_CLIENT_MARKER_MISSING");
  for (const [file, content] of privateAssets) {
    const pathname = `/${file.split("/").map(encodeURIComponent).join("/")}`;
    const denied = yield* fetchResponse(`${adminOrigin}${pathname}`, {
      timeout: 5000,
    });
    yield* ensure(denied.status === 401, "E2E_ADMIN_ASSET_BYPASSES_GATE");
    const absent = yield* fetchResponse(`${userOrigin}${pathname}`, {
      timeout: 5000,
    });
    const served = yield* Effect.tryPromise(() => absent.arrayBuffer());
    yield* ensure(!Buffer.from(served).equals(content), "E2E_ADMIN_ASSET_SERVED_BY_USER");
  }
  const response = yield* fetchResponse(`${userOrigin}/api/users`, {
    timeout: 5000,
  });
  yield* ensure(response.status === 404, "E2E_ADMIN_ROUTE_EXPOSED_BY_USER");
  for (const origin of [userOrigin, adminOrigin]) yield* verifyExplorerBoundary(origin);
});
