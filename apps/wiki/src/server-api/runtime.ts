import { ManagedRuntime } from "effect";
import { env } from "cloudflare:workers";
import { routes } from "#/telemetry-routes.ts";
import { wikiLayer } from "@template/runtime/wiki";

const runtime = ManagedRuntime.make(wikiLayer(env, routes));

export { runtime };
