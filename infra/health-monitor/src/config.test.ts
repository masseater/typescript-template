import { describe, expect, it } from "vite-plus/test";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";

const valid = {
  ADMIN_ORIGIN: "https://admin.example.com",
  USER_ORIGIN: "https://app.example.com",
  WIKI_ORIGIN: "https://wiki.example.com",
};

describe("health monitor configuration", () => {
  it("accepts distinct https origins", () => {
    expect.hasAssertions();
    expect(healthTargets(parseHealthMonitorConfig(valid))).toStrictEqual([
      { origin: "https://app.example.com", service: "user" },
      { origin: "https://admin.example.com", service: "admin" },
      { origin: "https://wiki.example.com", service: "wiki" },
    ]);
  });

  it.each([
    { USER_ORIGIN: "http://app.example.com" },
    { WIKI_ORIGIN: "https://app.example.com/docs" },
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
