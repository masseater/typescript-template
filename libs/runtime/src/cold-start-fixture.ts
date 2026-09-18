import { Context, Effect, Layer } from "effect";

import { Telemetry } from "@repo/observability";

import { workerRuntime } from "./worker-runtime.ts";
import { serveWorker } from "./worker.ts";

class Slow extends Context.Service<Slow, { readonly value: string }>()("Slow") {}

const buildTime = "300 millis";
const slowBuild = Effect.sleep(buildTime).pipe(Effect.as({ value: "built" }));
const telemetry = Layer.orDie(
  Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: "user" }),
);
const runtime = workerRuntime(() => Layer.merge(Layer.effect(Slow, slowBuild), telemetry));

const respondBuilt = Effect.gen(function* respond() {
  const slow = yield* Slow;
  return new Response(slow.value);
});

const coldStartWorker = serveWorker(runtime, () => respondBuilt, { service: "user" });

function coldStartFixturePath(): string {
  return new URL(import.meta.url).pathname;
}

export { coldStartFixturePath };
// oxlint-disable-next-line import/no-default-export
export default coldStartWorker;
