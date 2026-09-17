import { dispatchUserApi, userApi } from "./api.ts";
import { createAppWorker } from "@template/runtime/app";
import { env } from "cloudflare:workers";
import handler from "@tanstack/react-start/server-entry";
import { routes } from "./telemetry-routes.ts";

// oxlint-disable-next-line import/no-default-export
export default createAppWorker({
  api: userApi,
  audience: "user",
  dispatch: dispatchUserApi,
  env,
  handler,
  routes,
});
