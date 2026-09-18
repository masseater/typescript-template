import handler from "@tanstack/react-start/server-entry";
import { serveApp, startRoute } from "@template/runtime/worker";

import { runtime } from "#shared/server-api/index.ts";

export default serveApp(runtime, startRoute(handler));
