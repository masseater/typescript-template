import { layer as workersTracing } from "@r_masseater/workers-tracing/effect";
import { Effect, Layer, ManagedRuntime } from "effect";

import { featureFlagsLive } from "#/pages/home/config/feature-flags.server";

const runtime = ManagedRuntime.make(Layer.mergeAll(featureFlagsLive, workersTracing));

type Services = ManagedRuntime.ManagedRuntime.Services<typeof runtime>;

const runRequest = <Success>(effect: Effect.Effect<Success, never, Services>): Promise<Success> =>
  effect.pipe(
    Effect.tapCause((cause) => Effect.logError("request failed", cause)),
    (logged) => runtime.runPromise(logged),
  );

export { runRequest };
