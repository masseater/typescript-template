import { describe, expect, it } from "vite-plus/test";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";

const valid = {
  ACCESS_ISSUER: "https://team.cloudflareaccess.com",
  ADMIN_ORIGIN: "https://admin.example.com",
  ALERT_FROM: "alerts@example.com",
  ALERT_TO: "operator@example.com,oncall@example.com",
  USER_ORIGIN: "https://app.example.com",
  WIKI_ORIGIN: "https://wiki.example.com",
};

describe("health monitor configuration", () => {
  it("accepts distinct https origins and verified operator addresses", () => {
    expect.hasAssertions();
    const config = parseHealthMonitorConfig(valid);
    expect(config.ALERT_TO).toStrictEqual(["operator@example.com", "oncall@example.com"]);
    expect(healthTargets(config)).toStrictEqual([
      { guard: undefined, origin: "https://app.example.com", service: "user" },
      {
        guard: "https://team.cloudflareaccess.com",
        origin: "https://admin.example.com",
        service: "admin",
      },
      { guard: undefined, origin: "https://wiki.example.com", service: "wiki" },
    ]);
  });

  it.each([
    { USER_ORIGIN: "http://app.example.com" },
    { WIKI_ORIGIN: "https://app.example.com/docs" },
    { ACCESS_ISSUER: "https://team.example.com" },
    { ALERT_TO: "private-not-an-address" },
  ] as const)("refuses invalid settings without echoing them: %j", (override) => {
    expect.hasAssertions();
    expect(() => parseHealthMonitorConfig({ ...valid, ...override })).toThrow(
      /^health_monitor_config_invalid$/u,
    );
  });

  it("refuses a configuration that points two applications at the same origin", () => {
    expect.hasAssertions();
    expect(() =>
      parseHealthMonitorConfig({ ...valid, WIKI_ORIGIN: "https://app.example.com" }),
    ).toThrow(/^health_monitor_origins_must_differ$/u);
  });
});
