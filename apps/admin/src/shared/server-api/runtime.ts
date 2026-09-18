import { env } from "cloudflare:workers";
import { ManagedRuntime } from "effect";

import { routes } from "#shared/telemetry/index.ts";
import { appLayer } from "@repo/runtime";

const runtime = ManagedRuntime.make(appLayer(env, "admin", routes));

export { runtime };
