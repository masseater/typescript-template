import type { Effect } from "effect";
import { ManagedRuntime } from "effect";

import { featureFlagsLive } from "#/shared/flags/index.server";

import { withCloudflareTracing } from "./tracing.server";

const runtime = ManagedRuntime.make(featureFlagsLive);

type Services = ManagedRuntime.ManagedRuntime.Services<typeof runtime>;

const runRequest = <Success>(effect: Effect.Effect<Success, never, Services>): Promise<Success> =>
  runtime.runPromise(withCloudflareTracing(effect));

export { runRequest };
