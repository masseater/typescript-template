import { env } from "cloudflare:workers";

import { routes } from "#shared/telemetry/index.ts";
import type { Reporting } from "@repo/observability";
import { appLayer, isolateRuntime } from "@repo/runtime";

const service = "admin";
const reporting: Reporting = { service };
const runtime = isolateRuntime(appLayer(env, service, routes));

export { reporting, runtime };
