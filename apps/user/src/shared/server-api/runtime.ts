import { Layer, ManagedRuntime } from "effect";
import { Interviewer } from "@repo/interview";
import { appLayer } from "@repo/runtime";
import { env } from "cloudflare:workers";
import { routes } from "#shared/telemetry/index.ts";

const runtime = ManagedRuntime.make(
  Layer.merge(appLayer(env, "user", routes), Interviewer.fromEnvironment(env)),
);

export { runtime };
