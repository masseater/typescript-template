import handler from "@tanstack/react-start/server-entry";
import { createAppWorker } from "@template/runtime/app";
import { env } from "cloudflare:workers";
import { dispatchUserApi, userApi } from "./api.ts";
import { routes } from "./telemetry-routes.ts";

export default createAppWorker({
  env,
  audience: "user",
  routes,
  handler,
  api: userApi,
  dispatch: dispatchUserApi,
});
