import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { healthTargets, parseHealthMonitorConfig } from "./config.ts";

const valid = {
  INTERNAL_DASHBOARD_ORIGIN: "https://wiki.example.com",
  SERVICE_ADMIN_ORIGIN: "https://admin.example.com",
  SERVICE_MEMBER_ORIGIN: "https://app.example.com",
} as const;

describe("parseHealthMonitorConfig", () => {
  const it = test.extend("healthProbeTargets", async () => {
    const config = await Effect.runPromise(parseHealthMonitorConfig(valid));
    return healthTargets(config);
  });

  it("accepts distinct https origins", ({ healthProbeTargets }) => {
    expect(healthProbeTargets).toStrictEqual([
      {
        healthEndpoint: "https://app.example.com/api/health",
        origin: "https://app.example.com",
        service: "service-member",
      },
      {
        healthEndpoint: "https://admin.example.com/api/health",
        origin: "https://admin.example.com",
        service: "service-admin",
      },
      {
        healthEndpoint: "https://wiki.example.com/api/health",
        origin: "https://wiki.example.com",
        service: "internal-dashboard",
      },
    ]);
  });
});

describe.for([
  [{ SERVICE_MEMBER_ORIGIN: "http://app.example.com" }],
  [{ INTERNAL_DASHBOARD_ORIGIN: "https://app.example.com/docs" }],
] as const)("invalid settings %s", ([override]) => {
  const it = test.extend("failureCode", async () => {
    const configFailure = await Effect.runPromise(
      Effect.flip(parseHealthMonitorConfig({ ...valid, ...override })),
    );
    return configFailure.code;
  });

  it("refuses the configuration", ({ failureCode }) => {
    expect(failureCode).toBe("health_monitor_config_invalid");
  });
});

describe("shared origins", () => {
  const it = test.extend("failureCode", async () => {
    const configFailure = await Effect.runPromise(
      Effect.flip(
        parseHealthMonitorConfig({ ...valid, INTERNAL_DASHBOARD_ORIGIN: "https://app.example.com" }),
      ),
    );
    return configFailure.code;
  });

  it("refuses a configuration that points two applications at the same origin", ({
    failureCode,
  }) => {
    expect(failureCode).toBe("health_monitor_origins_must_differ");
  });
});
