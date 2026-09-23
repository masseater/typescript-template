import { APPLICATION, ConfigurationInvalid } from "@repo/config";
import { flagshipFeatureFlagsLayer } from "@repo/feature-flags";
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
    appLayer(env, service, routes),
    Layer.unwrap(
      readWorkerConfig(env).pipe(
        Effect.flatMap((config) => {
          if (config.FLAGS === undefined) {
            return Effect.fail(new ConfigurationInvalid({ reason: "FLAGS" }));
          }
          return Effect.succeed(
            Layer.mergeAll(opsMailLayer(config), flagshipFeatureFlagsLayer(config.FLAGS)),
          );
        }),
      ),
    ),
    Interviewer.fromEnvironment(env),
  ),
);

export { reporting, runtime };
