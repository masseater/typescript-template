import { serveApp, startRoute } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { runtime } from "#shared/server-api/index.ts";

// oxlint-disable-next-line import/no-default-export
export default serveApp(runtime, startRoute(handler));
