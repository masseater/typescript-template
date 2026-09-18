import { ManagedRuntime } from "effect";
import { appLayer } from "@repo/runtime";
import { env } from "cloudflare:workers";
import { routes } from "#shared/telemetry/index.ts";

const runtime = ManagedRuntime.make(appLayer(env, "admin", routes));

export { runtime };
