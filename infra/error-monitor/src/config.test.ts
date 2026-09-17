import { expect, test } from "vitest";
import { parseErrorMonitorConfig } from "./config.ts";

const valid = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  OBSERVABILITY_TOKEN: "t".repeat(40),
  ALERT_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/secret",
};

test("accepts an HTTPS webhook and a scoped token", () => {
  expect(parseErrorMonitorConfig(valid)).toEqual(valid);
});

test.each([
  { ALERT_WEBHOOK_URL: "not-a-url" },
  { ALERT_WEBHOOK_URL: "http://hooks.slack.com/services/T/B/secret" },
  { OBSERVABILITY_TOKEN: "short" },
])("refuses invalid settings without echoing them: %j", (override) => {
  expect(() => parseErrorMonitorConfig({ ...valid, ...override })).toThrow(
    /^error_monitor_config_invalid$/,
  );
});
