import { assert, it } from "@effect/vitest";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";
import { Effect } from "effect";

const valid = {
  ADMIN_ORIGIN: "https://admin.example.com",
  USER_ORIGIN: "https://app.example.com",
  WIKI_ORIGIN: "https://wiki.example.com",
};

function code(
  input: unknown,
): Effect.Effect<
  "health_monitor_config_invalid" | "health_monitor_origins_must_differ",
  { readonly ADMIN_ORIGIN: string; readonly USER_ORIGIN: string; readonly WIKI_ORIGIN: string }
> {
  return parseHealthMonitorConfig(input).pipe(
    Effect.flip,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map((failure) => failure.code),
  );
}

it.effect("accepts distinct https origins", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(healthTargets(yield* parseHealthMonitorConfig(valid)), [
      { origin: "https://app.example.com", service: "user" },
      { origin: "https://admin.example.com", service: "admin" },
      { origin: "https://wiki.example.com", service: "wiki" },
    ]);
  }),
);

for (const override of [
  { USER_ORIGIN: "http://app.example.com" },
  { WIKI_ORIGIN: "https://app.example.com/docs" },
]) {
  it.effect(`refuses invalid settings without echoing them: ${JSON.stringify(override)}`, () =>
    Effect.gen(function* program() {
      assert.strictEqual(yield* code({ ...valid, ...override }), "health_monitor_config_invalid");
    }),
  );
}

it.effect("refuses a configuration that points two applications at the same origin", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* code({ ...valid, WIKI_ORIGIN: "https://app.example.com" }),
      "health_monitor_origins_must_differ",
    );
  }),
);
