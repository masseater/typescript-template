import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { parseErrorMonitorConfig } from "./config.ts";

const valid = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  OBSERVABILITY_TOKEN: "t".repeat(40),
  ALERT_FROM: "alerts@example.com",
  ALERT_TO: "operator@example.com,oncall@example.com",
};

it.effect("accepts a scoped token and verified operator addresses", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(yield* parseErrorMonitorConfig(valid), {
      ...valid,
      ALERT_TO: ["operator@example.com", "oncall@example.com"],
    });
  }),
);

for (const override of [
  { ALERT_TO: "private-not-an-address" },
  { ALERT_FROM: "" },
  { OBSERVABILITY_TOKEN: "short" },
])
  it.effect(`refuses invalid settings without echoing them: ${JSON.stringify(override)}`, () =>
    Effect.gen(function* () {
      const failure = yield* parseErrorMonitorConfig({ ...valid, ...override }).pipe(Effect.flip);
      assert.strictEqual(failure.code, "error_monitor_config_invalid");
      assert.notInclude(JSON.stringify(failure), "private-not-an-address");
    }),
  );
