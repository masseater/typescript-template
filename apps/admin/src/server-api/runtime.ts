import { ManagedRuntime } from "effect";
import { appLayer } from "@template/runtime";
import { env } from "cloudflare:workers";
import { routes } from "#telemetry-routes.ts";

const runtime = ManagedRuntime.make(appLayer(env, "admin", routes));

export { runtime };
