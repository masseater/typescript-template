import { wikiLayer, wikiService } from "@repo/runtime/wiki";
import { env } from "cloudflare:workers";
import { ManagedRuntime } from "effect";

import { routes } from "#shared/telemetry/index.ts";

import type { Reporting } from "@repo/observability";

const reporting: Reporting = { service: wikiService };
const runtime = ManagedRuntime.make(wikiLayer(env, routes));

export { reporting, runtime };
