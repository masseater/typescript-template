import { createAppWorker, startRoute } from "@template/runtime/app";
import { adminApi } from "./api.ts";
import handler from "@tanstack/react-start/server-entry";
import { runtime } from "./runtime.ts";

// oxlint-disable-next-line import/no-default-export
export default createAppWorker({ api: adminApi, route: startRoute(handler), runtime });
