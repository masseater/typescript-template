import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { parseErrorMonitorConfig } from "./config.ts";

const ACCOUNT_ID_LENGTH = 32;
const TOKEN_LENGTH = 40;

const valid = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(ACCOUNT_ID_LENGTH),
  OBSERVABILITY_TOKEN: "t".repeat(TOKEN_LENGTH),
};

it.effect("accepts a scoped token", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(yield* parseErrorMonitorConfig(valid), valid);
  }),
);

for (const override of [
  { CLOUDFLARE_ACCOUNT_ID: "private-not-an-account" },
  { OBSERVABILITY_TOKEN: "short" },
]) {
  it.effect(`refuses invalid settings without echoing them: ${JSON.stringify(override)}`, () =>
    Effect.gen(function* program() {
      const failure = yield* parseErrorMonitorConfig({ ...valid, ...override }).pipe(Effect.flip);
      assert.strictEqual(failure.code, "error_monitor_config_invalid");
      assert.notInclude(JSON.stringify(failure), "private-not-an-account");
    }),
  );
}
