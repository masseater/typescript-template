import { enforceAdminAccess, localAccessCookie } from "#access.ts";
import { createAppWorker } from "@template/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { routes } from "#telemetry-routes.ts";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function withLocalAccessCookie(response: Response, bindings: unknown): Promise<Response> {
  const cookie = await localAccessCookie(bindings);
  if (cookie === undefined) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

const worker = createAppWorker({
  audience: "admin",
  finalize: withLocalAccessCookie,
  gate: enforceAdminAccess,
  handler,
  routes,
});

// oxlint-disable-next-line import/no-default-export
export default worker;
