import { serveApp, startRoute } from "@template/runtime/worker";
import { adminApi } from "./api.ts";
import handler from "@tanstack/react-start/server-entry";
import { runtime } from "./runtime.ts";

// oxlint-disable-next-line import/no-default-export
export default serveApp(runtime, startRoute(handler, adminApi));
