import { expect, test } from "vite-plus/test";
import { parseErrorMonitorConfig } from "./config.ts";

const valid = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  OBSERVABILITY_TOKEN: "t".repeat(40),
};

test("accepts a scoped token", () => {
  expect(parseErrorMonitorConfig(valid)).toEqual(valid);
});

test.each([{ CLOUDFLARE_ACCOUNT_ID: "private-not-an-account" }, { OBSERVABILITY_TOKEN: "short" }])(
  "refuses invalid settings without echoing them: %j",
  (override) => {
    expect(() => parseErrorMonitorConfig({ ...valid, ...override })).toThrow(
      /^error_monitor_config_invalid$/,
    );
  },
);
