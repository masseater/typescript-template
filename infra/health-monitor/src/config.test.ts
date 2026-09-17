import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";

const valid = {
  USER_ORIGIN: "https://app.example.com",
  ADMIN_ORIGIN: "https://admin.example.com",
  WIKI_ORIGIN: "https://wiki.example.com",
};

const code = (input: unknown) =>
  parseHealthMonitorConfig(input).pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );

it.effect("accepts distinct https origins", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(healthTargets(yield* parseHealthMonitorConfig(valid)), [
      { service: "user", origin: "https://app.example.com" },
      { service: "admin", origin: "https://admin.example.com" },
      { service: "wiki", origin: "https://wiki.example.com" },
    ]);
  }),
);

for (const override of [
  { USER_ORIGIN: "http://app.example.com" },
  { WIKI_ORIGIN: "https://app.example.com/docs" },
])
  it.effect(`refuses invalid settings without echoing them: ${JSON.stringify(override)}`, () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* code({ ...valid, ...override }), "health_monitor_config_invalid");
    }),
  );

it.effect("refuses a configuration that points two applications at the same origin", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code({ ...valid, WIKI_ORIGIN: "https://app.example.com" }),
      "health_monitor_origins_must_differ",
    );
  }),
);
