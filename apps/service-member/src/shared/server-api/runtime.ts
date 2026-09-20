import { APPLICATION, readConfig } from "@repo/config";
import { appLayer } from "@repo/runtime";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { Interviewer } from "#shared/interview/index.ts";
import { PhotoStore } from "#shared/photo/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { opsMailLayer } from "./ops-mail.ts";

import type { Reporting } from "@repo/observability";

const service = APPLICATION.user;
const reporting: Reporting = { service };
const runtime = workerRuntime(() =>
  Layer.mergeAll(
    appLayer(env, service, routes),
    Layer.unwrap(readConfig(env).pipe(Effect.map(opsMailLayer))),
    Interviewer.fromEnvironment(env),
    PhotoStore.fromEnvironment(env),
  ),
);

export { reporting, runtime };
