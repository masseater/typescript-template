import { Effect, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  GoogleAnalyticsMeasurementId,
  activeGoogleAnalyticsMeasurementId,
} from "./google-analytics-measurement-id.ts";

describe("GoogleAnalyticsMeasurementId", () => {
  describe.for(["G-ABCDEFGHIJ", "G-123"])("well-formed %s", (candidate) => {
    const it = test.extend("decoded", () =>
      Effect.runPromise(Schema.decodeEffect(GoogleAnalyticsMeasurementId)(candidate)));

    it("is accepted", ({ decoded }) => {
      expect(decoded).toBe(candidate);
    });
  });

  describe.for(["UA-123456-1", "G-", "not-an-id"])("malformed %s", (candidate) => {
    const it = test.extend("decoded", () =>
      Effect.runPromise(
        Schema.decodeEffect(GoogleAnalyticsMeasurementId)(candidate).pipe(
          Effect.orElseSucceed(() => undefined),
        ),
      ));

    it("is refused", ({ decoded }) => {
      expect(decoded).toBe(undefined);
    });
  });
});

describe("activeGoogleAnalyticsMeasurementId", () => {
  const measurementId = "G-ACTIVE123456";

  describe("a public deployment with a configured id", () => {
    const it = test.extend("active", () =>
      activeGoogleAnalyticsMeasurementId({
        GOOGLE_ANALYTICS_MEASUREMENT_ID: measurementId,
        local: false,
      }));

    it("returns the id", ({ active }) => {
      expect(active).toBe(measurementId);
    });
  });

  describe.for([
    ["local development", { GOOGLE_ANALYTICS_MEASUREMENT_ID: measurementId, local: true }],
    ["a missing id", { local: false }],
  ] as const)("%s", ([, input]) => {
    const it = test.extend("active", () => activeGoogleAnalyticsMeasurementId(input));

    it("keeps analytics off", ({ active }) => {
      expect(active).toBe(undefined);
    });
  });
});
