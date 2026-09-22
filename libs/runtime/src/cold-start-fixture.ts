import { APPLICATION } from "@repo/config";
import { Telemetry } from "@repo/observability";
import { Context, Effect, Layer } from "effect";

import { serveWorker, workerRuntime } from "./worker.ts";

class Slow extends Context.Service<Slow, { readonly value: string }>()("Slow") {}

const buildTime = "300 millis";
const slowBuild = Effect.sleep(buildTime).pipe(Effect.as({ value: "built" }));
const telemetry = Layer.orDie(
  Telemetry.layer({ release: "test", routes: { "/": "home" }, serviceName: APPLICATION.user }),
);
const runtime = workerRuntime(() => Layer.merge(Layer.effect(Slow, slowBuild), telemetry));

const respondBuilt = Effect.gen(function* respond() {
  const slow = yield* Slow;
  return new Response(slow.value);
});

const coldStartWorker = serveWorker({
  reporting: { service: APPLICATION.user },
  route: () => respondBuilt,
  runtime,
});

function coldStartFixturePath(): string {
  return new URL(import.meta.url).pathname;
}

export { coldStartFixturePath };
export default coldStartWorker;
