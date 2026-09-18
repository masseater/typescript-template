import { env } from "cloudflare:workers";
import { ManagedRuntime } from "effect";

import { routes } from "#shared/telemetry/index.ts";
import type { Reporting } from "@repo/observability";
import { appLayer } from "@repo/runtime";

const service = "admin";
const reporting: Reporting = { service };
const runtime = ManagedRuntime.make(appLayer(env, service, routes));

export { reporting, runtime };
