import type { Effect } from "effect";
import { Layer, Logger, ManagedRuntime } from "effect";

import { featureFlagsLive } from "#/shared/flags/index.server";

import { withCloudflareTracing } from "./tracing.server";

const loggerLive = Logger.layer([Logger.withLeveledConsole(Logger.formatStructured)]);

const runtime = ManagedRuntime.make(Layer.mergeAll(featureFlagsLive, loggerLive));

type Services = ManagedRuntime.ManagedRuntime.Services<typeof runtime>;

const runRequest = <Success>(effect: Effect.Effect<Success, never, Services>): Promise<Success> =>
  runtime.runPromise(withCloudflareTracing(effect));

export { runRequest };
