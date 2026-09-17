import { expect, test } from "vitest";
import { parseErrorMonitorConfig } from "./config.ts";

const valid = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  OBSERVABILITY_TOKEN: "t".repeat(40),
  ALERT_FROM: "alerts@example.com",
  ALERT_TO: "operator@example.com,oncall@example.com",
};

test("accepts a scoped token and verified operator addresses", () => {
  expect(parseErrorMonitorConfig(valid)).toEqual({
    ...valid,
    ALERT_TO: ["operator@example.com", "oncall@example.com"],
  });
});

test.each([
  { ALERT_TO: "private-not-an-address" },
  { ALERT_FROM: "" },
  { OBSERVABILITY_TOKEN: "short" },
])("refuses invalid settings without echoing them: %j", (override) => {
  expect(() => parseErrorMonitorConfig({ ...valid, ...override })).toThrow(
    /^error_monitor_config_invalid$/,
  );
});
