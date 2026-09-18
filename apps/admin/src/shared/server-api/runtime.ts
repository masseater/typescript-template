import { env } from "cloudflare:workers";

import { routes } from "#shared/telemetry/index.ts";
import type { Reporting } from "@repo/observability";
import { appLayer } from "@repo/runtime";
import { workerRuntime } from "@repo/runtime/worker";

const service = "admin";
const reporting: Reporting = { service };
const runtime = workerRuntime(() => appLayer(env, service, routes));

export { reporting, runtime };
