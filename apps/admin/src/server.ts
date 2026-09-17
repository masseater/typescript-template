import handler from "@tanstack/react-start/server-entry";
import { createAppWorker } from "@template/runtime/app";
import { env } from "cloudflare:workers";
import { adminApi, dispatchAdminApi } from "./api.ts";
import { routes } from "./telemetry-routes.ts";

export default createAppWorker({
  env,
  audience: "admin",
  routes,
  handler,
  api: adminApi,
  dispatch: dispatchAdminApi,
});
