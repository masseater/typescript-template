import { wikiLayer, wikiService } from "@repo/runtime/wiki";
import { ManagedRuntime } from "effect";
import type { Reporting } from "@repo/observability";
import { env } from "cloudflare:workers";
import { routes } from "#shared/telemetry/index.ts";

const reporting: Reporting = { service: wikiService };
const runtime = ManagedRuntime.make(wikiLayer(env, routes));

export { reporting, runtime };
