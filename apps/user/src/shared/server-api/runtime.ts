import { Layer, ManagedRuntime } from "effect";
import { Interviewer } from "@repo/interview";
import type { Reporting } from "@repo/observability";
import { appLayer } from "@repo/runtime";
import { env } from "cloudflare:workers";
import { routes } from "#shared/telemetry/index.ts";

const service = "user";
const reporting: Reporting = { service };
const runtime = ManagedRuntime.make(
  Layer.merge(appLayer(env, service, routes), Interviewer.fromEnvironment(env)),
);

export { reporting, runtime };
