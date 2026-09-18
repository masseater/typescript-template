import { wikiLayer } from "@template/runtime/wiki";
import { env } from "cloudflare:workers";
import { ManagedRuntime } from "effect";

import { routes } from "#shared/telemetry/index.ts";

const runtime = ManagedRuntime.make(wikiLayer(env, routes));

export { runtime };
