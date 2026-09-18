import { env } from "cloudflare:workers";

import { routes } from "#shared/telemetry/index.ts";
import type { Reporting } from "@repo/observability";
import { isolateRuntime } from "@repo/runtime";
import { wikiLayer, wikiService } from "@repo/runtime/wiki";

const reporting: Reporting = { service: wikiService };
const runtime = isolateRuntime(wikiLayer(env, routes));

export { reporting, runtime };
