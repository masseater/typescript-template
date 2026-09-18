import { Interviewer } from "@repo/interview";
import { appLayer } from "@repo/runtime";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Layer } from "effect";

import { routes } from "#shared/telemetry/index.ts";

import type { Reporting } from "@repo/observability";

const service = "user";
const reporting: Reporting = { service };
const runtime = workerRuntime(() =>
  Layer.merge(appLayer(env, service, routes), Interviewer.fromEnvironment(env)),
);

export { reporting, runtime };
