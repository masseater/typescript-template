import { Effect } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

describe("the sdk vitest is handed", () => {
  const it = test.extend("sharesTheShutdownOfTheProcessTelemetry", () =>
    Effect.runPromise(
      Effect.gen(function* sharedShutdown() {
        vi.resetModules();
        const sdk = yield* Effect.promise(() => import("./vitest-sdk.ts"));
        const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
        return sdk.default.shutdown === telemetry.startTelemetry("mst-other").shutdown;
      }),
    ));

  it("stops the same telemetry every later entry of the process is handed", ({
    sharesTheShutdownOfTheProcessTelemetry,
  }) => {
    expect(sharesTheShutdownOfTheProcessTelemetry).toBe(true);
  });
});
