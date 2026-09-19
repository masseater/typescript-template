import { Effect, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { AlertEnvironment } from "./alert-environment.ts";

describe("AlertEnvironment", () => {
  describe("a sender and a comma separated list of operators", () => {
    const it = test.extend("alertEnvironment", async () =>
      Effect.runPromise(
        Schema.decodeUnknownEffect(AlertEnvironment)({
          ALERT_FROM: "alerts@example.com",
          ALERT_TO: "operator@example.com,oncall@example.com",
        }),
      ));

    it("splits the operators into one address each", ({ alertEnvironment }) => {
      expect(alertEnvironment).toStrictEqual({
        ALERT_FROM: "alerts@example.com",
        ALERT_TO: ["operator@example.com", "oncall@example.com"],
      });
    });
  });

  describe.for([
    ["an operator that is not an address", { ALERT_TO: "private-not-an-address" }],
    ["an empty sender", { ALERT_FROM: "" }],
    [
      "eleven operators",
      {
        ALERT_TO: Array.from(
          { length: 11 },
          (_unused, index) => `operator${String(index)}@example.com`,
        ).join(","),
      },
    ],
  ] as const)("%s", ([, overridden]) => {
    const it = test.extend("decodeSucceeded", async () => {
      const decodeExit = await Effect.runPromiseExit(
        Schema.decodeUnknownEffect(AlertEnvironment)({
          ALERT_FROM: "alerts@example.com",
          ALERT_TO: "operator@example.com",
          ...overridden,
        }),
      );
      return decodeExit._tag === "Success";
    });

    it("is refused", ({ decodeSucceeded }) => {
      expect(decodeSucceeded).toBe(false);
    });
  });
});
