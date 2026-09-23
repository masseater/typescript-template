import { APPLICATION } from "@repo/config";
import { appLayer, readWorkerConfig } from "@repo/runtime/bindings";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { Interviewer } from "#shared/interview/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { opsMailLayer } from "./ops-mail.ts";

import type { Reporting } from "@repo/observability";

const service = APPLICATION.user;
const reporting: Reporting = { service };
const runtime = workerRuntime(() =>
  Layer.mergeAll(
    appLayer({ env: env, audience: service, routes: routes }),
    Layer.unwrap(readWorkerConfig(env).pipe(Effect.map((config) => opsMailLayer(config)))),
    Interviewer.fromEnvironment(env),
  ),
);

export { reporting, runtime };
