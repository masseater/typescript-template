import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { ErrorMonitorFailure, parseErrorMonitorConfig } from "./config.ts";

const ACCOUNT_ID_LENGTH = 32;
const TOKEN_LENGTH = 40;

const valid = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(ACCOUNT_ID_LENGTH),
  OBSERVABILITY_TOKEN: "t".repeat(TOKEN_LENGTH),
} as const;

describe("parseErrorMonitorConfig", () => {
  const it = test.extend("acceptedConfig", () =>
    Effect.runPromise(parseErrorMonitorConfig(valid)));

  it("accepts a scoped token", ({ acceptedConfig }) => {
    expect(acceptedConfig).toStrictEqual(valid);
  });
});

describe.for([
  [{ CLOUDFLARE_ACCOUNT_ID: "private-not-an-account" }],
  [{ OBSERVABILITY_TOKEN: "short" }],
] as const)("invalid settings %s", ([override]) => {
  const it = test.extend("configFailure", () =>
    Effect.runPromise(Effect.flip(parseErrorMonitorConfig({ ...valid, ...override }))));

  it("refuses without echoing the invalid value", ({ configFailure }) => {
    expect(configFailure).toStrictEqual(
      new ErrorMonitorFailure({ code: "error_monitor_config_invalid", keys: [] }),
    );
  });
});
