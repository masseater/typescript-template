import { APPLICATION } from "@repo/config";
import {
  type FeatureFlags,
  flagshipFeatureFlagsLayer,
  memoryFeatureFlagsLayer,
} from "@repo/feature-flags";
import { appLayer, readWorkerConfig } from "@repo/runtime/bindings";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { Interviewer } from "#shared/interview/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { OpsMail, opsMailLayer } from "./ops-mail.ts";

import type { Reporting } from "@repo/observability";

const service = APPLICATION.user;
const reporting: Reporting = { service };
const runtime = workerRuntime(() =>
  Layer.mergeAll(
    appLayer({ env: env, audience: service, routes: routes }),
    Layer.unwrap(
      readWorkerConfig(env).pipe(
        Effect.map((config): Layer.Layer<FeatureFlags | OpsMail> =>
          Layer.mergeAll(
            opsMailLayer(config),
            config.FLAGS === undefined
              ? memoryFeatureFlagsLayer
              : flagshipFeatureFlagsLayer(config.FLAGS),
          ),
        ),
      ),
    ),
    Interviewer.fromEnvironment(env),
  ),
);

export { reporting, runtime };
