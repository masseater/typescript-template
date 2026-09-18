import { env } from "cloudflare:workers";
import { ManagedRuntime } from "effect";

import { routes } from "#shared/telemetry/index.ts";
import { wikiLayer } from "@repo/runtime/wiki";

const runtime = ManagedRuntime.make(wikiLayer(env, routes));

export { runtime };
