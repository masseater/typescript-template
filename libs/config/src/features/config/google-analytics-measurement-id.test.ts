import { Effect, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  GoogleAnalyticsMeasurementId,
  activeGoogleAnalyticsMeasurementId,
} from "./google-analytics-measurement-id.ts";

describe("GoogleAnalyticsMeasurementId", () => {
  describe.for([
    ["G-ABCDEFGHIJ", true],
    ["G-123", true],
    ["UA-123456-1", false],
    ["G-", false],
    ["not-an-id", false],
  ] as const)("%s", ([candidate, accepted]) => {
    const it = test.extend("decoded", () =>
      Effect.runPromise(Schema.decodeEffect(GoogleAnalyticsMeasurementId)(candidate)).catch(
        () => undefined,
      ));

    it(accepted ? "is accepted" : "is refused", ({ decoded }) => {
      if (accepted) {
        expect(decoded).toBe(candidate);
      } else {
        expect(decoded).toBeUndefined();
      }
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
      expect(active).toBeUndefined();
    });
  });
});
