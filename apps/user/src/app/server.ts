import { createAppWorker, startRoute } from "@template/runtime/app";
import handler from "@tanstack/react-start/server-entry";
import { runtime } from "./runtime.ts";
import { userApi } from "./api.ts";

// oxlint-disable-next-line import/no-default-export
export default createAppWorker({ api: userApi, route: startRoute(handler), runtime });
