import { expect, test } from "vite-plus/test";
import { healthTargets, parseHealthMonitorConfig } from "./config.ts";

const valid = {
  USER_ORIGIN: "https://app.example.com",
  ADMIN_ORIGIN: "https://admin.example.com",
  WIKI_ORIGIN: "https://wiki.example.com",
};

test("accepts distinct https origins", () => {
  expect(healthTargets(parseHealthMonitorConfig(valid))).toEqual([
    { service: "user", origin: "https://app.example.com" },
    { service: "admin", origin: "https://admin.example.com" },
    { service: "wiki", origin: "https://wiki.example.com" },
  ]);
});

test.each([
  { USER_ORIGIN: "http://app.example.com" },
  { WIKI_ORIGIN: "https://app.example.com/docs" },
])("refuses invalid settings without echoing them: %j", (override) => {
  expect(() => parseHealthMonitorConfig({ ...valid, ...override })).toThrow(
    /^health_monitor_config_invalid$/,
  );
});

test("refuses a configuration that points two applications at the same origin", () => {
  expect(() =>
    parseHealthMonitorConfig({ ...valid, WIKI_ORIGIN: "https://app.example.com" }),
  ).toThrow(/^health_monitor_origins_must_differ$/);
});
