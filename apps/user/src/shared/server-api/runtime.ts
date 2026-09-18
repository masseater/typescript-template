import { env } from "cloudflare:workers";
import { Layer, ManagedRuntime } from "effect";

import { routes } from "#shared/telemetry/index.ts";
import { Interviewer } from "@repo/interview";
import { appLayer } from "@repo/runtime";

const runtime = ManagedRuntime.make(
  Layer.merge(appLayer(env, "user", routes), Interviewer.fromEnvironment(env)),
);

export { runtime };
