import { serveApp, startRoute } from "@template/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { runtime } from "./runtime.ts";
import { wikiApi } from "./api.ts";

// oxlint-disable-next-line import/no-default-export
export default serveApp(runtime, startRoute(handler, wikiApi));
