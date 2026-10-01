import { waitUntil } from "cloudflare:workers";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Flusher, layerFlusher } from "effect/unstable/observability/OtlpExporter";

import { featureFlagsLive } from "#/shared/flags/index.server";
import { telemetryLive } from "#/shared/telemetry/index.server";

const runtime = ManagedRuntime.make(Layer.mergeAll(featureFlagsLive, telemetryLive, layerFlusher));

type Services = ManagedRuntime.ManagedRuntime.Services<typeof runtime>;

const flushTelemetry = Effect.gen(function* flushTelemetry() {
  const flusher = yield* Flusher;
  yield* flusher.flush;
});

const scheduleFlush = Effect.sync(() => {
  waitUntil(runtime.runPromise(flushTelemetry));
});

const runRequest = <Success>(effect: Effect.Effect<Success, never, Services>): Promise<Success> =>
  runtime.runPromise(effect.pipe(Effect.ensuring(scheduleFlush)));

export { runRequest };
