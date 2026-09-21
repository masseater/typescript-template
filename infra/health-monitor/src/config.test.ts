import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { healthTargets, parseHealthMonitorConfig } from "./config.ts";

const valid = {
  SERVICE_ADMIN_ORIGIN: "https://admin.example.com",
  SERVICE_MEMBER_ORIGIN: "https://app.example.com",
  INTERNAL_DASHBOARD_ORIGIN: "https://wiki.example.com",
};

function code(input: unknown): Effect.Effect<
  "health_monitor_config_invalid" | "health_monitor_origins_must_differ",
  {
    readonly SERVICE_ADMIN_ORIGIN: string;
    readonly SERVICE_MEMBER_ORIGIN: string;
    readonly INTERNAL_DASHBOARD_ORIGIN: string;
  }
> {
  return parseHealthMonitorConfig(input).pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );
}

it.effect("accepts distinct https origins", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(healthTargets(yield* parseHealthMonitorConfig(valid)), [
      { origin: "https://app.example.com", service: "service-member" },
      { origin: "https://admin.example.com", service: "service-admin" },
      { origin: "https://wiki.example.com", service: "internal-dashboard" },
    ]);
  }),
);

for (const override of [
  { SERVICE_MEMBER_ORIGIN: "http://app.example.com" },
  { INTERNAL_DASHBOARD_ORIGIN: "https://app.example.com/docs" },
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
      yield* code({ ...valid, INTERNAL_DASHBOARD_ORIGIN: "https://app.example.com" }),
      "health_monitor_origins_must_differ",
    );
  }),
);
