import handler from "@tanstack/react-start/server-entry";
import { createAppWorker } from "@template/runtime/worker";
import { enforceAdminAccess, localAccessCookie } from "./access.ts";
import { routes } from "./telemetry-routes.ts";

export default createAppWorker({
  audience: "admin",
  routes,
  handler,
  gate: enforceAdminAccess,
  async finalize(response, bindings) {
    const cookie = await localAccessCookie(bindings);
    if (!cookie) return response;
    const headers = new Headers(response.headers);
    headers.append("set-cookie", cookie);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
