import { describe, expect, it } from "vite-plus/test";
import { parseErrorMonitorConfig } from "./config.ts";

const HEX_32_LENGTH = 32;
const TOKEN_LENGTH = 40;

const valid = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(HEX_32_LENGTH),
  OBSERVABILITY_TOKEN: "t".repeat(TOKEN_LENGTH),
};

describe("error monitor configuration", () => {
  it("accepts a scoped token", () => {
    expect.hasAssertions();
    expect(parseErrorMonitorConfig(valid)).toStrictEqual(valid);
  });

  it.each([
    { CLOUDFLARE_ACCOUNT_ID: "private-not-an-account" },
    { OBSERVABILITY_TOKEN: "short" },
  ] as const)("refuses invalid settings without echoing them: %j", (override) => {
    expect.hasAssertions();
    expect(() => parseErrorMonitorConfig({ ...valid, ...override })).toThrow(
      /^error_monitor_config_invalid$/u,
    );
  });
});
