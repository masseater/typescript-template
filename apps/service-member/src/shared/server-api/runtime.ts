import { readConfig } from "@repo/config";
import { Interviewer } from "@repo/interview";
import { appLayer } from "@repo/runtime";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { routes } from "#shared/telemetry/index.ts";
import { opsMailLayer } from "./ops-mail.ts";

import type { Reporting } from "@repo/observability";

const service = "service-member";
const reporting: Reporting = { service };
const runtime = workerRuntime(() =>
  Layer.mergeAll(
    appLayer(env, service, routes),
    Layer.unwrap(readConfig(env).pipe(Effect.map(opsMailLayer))),
    Interviewer.fromEnvironment(env),
  ),
);

export { reporting, runtime };
