import { ManagedRuntime } from "effect";
import type { Reporting } from "@repo/observability";
import { appLayer } from "@repo/runtime";
import { env } from "cloudflare:workers";
import { routes } from "#shared/telemetry/index.ts";

const service = "admin";
const reporting: Reporting = { service };
const runtime = ManagedRuntime.make(appLayer(env, service, routes));

export { reporting, runtime };
