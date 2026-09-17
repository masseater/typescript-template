import { describe, expect, it } from "vite-plus/test";
import { parseErrorMonitorConfig } from "./config.ts";

const HEX_32_LENGTH = 32;
const TOKEN_LENGTH = 40;

const valid = {
  ALERT_FROM: "alerts@example.com",
  ALERT_TO: "operator@example.com,oncall@example.com",
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(HEX_32_LENGTH),
  OBSERVABILITY_TOKEN: "t".repeat(TOKEN_LENGTH),
};

describe("error monitor configuration", () => {
  it("accepts a scoped token and verified operator addresses", () => {
    expect.hasAssertions();
    expect(parseErrorMonitorConfig(valid)).toStrictEqual({
      ...valid,
      ALERT_TO: ["operator@example.com", "oncall@example.com"],
    });
  });

  it.each([
    { ALERT_TO: "private-not-an-address" },
    { ALERT_FROM: "" },
    { OBSERVABILITY_TOKEN: "short" },
  ] as const)("refuses invalid settings without echoing them: %j", (override) => {
    expect.hasAssertions();
    expect(() => parseErrorMonitorConfig({ ...valid, ...override })).toThrow(
      /^error_monitor_config_invalid$/u,
    );
  });
});
