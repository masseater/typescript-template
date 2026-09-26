import { ConfigProvider, Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  continuousIntegration,
  inheritedEnvironment,
  telemetrySettings,
} from "./process-environment.ts";

describe("continuousIntegration", () => {
  describe.for([
    ["1", true],
    ["true", true],
    ["0", false],
    ["false", false],
    ["", false],
  ] as const)("an accepted CI=%s", ([spelling, signalledSetting]) => {
    const it = test.extend("signalled", () =>
      Effect.runPromise(
        continuousIntegration.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: { CI: spelling } }),
          ),
        ),
      ));

    it(`reads as ${String(signalledSetting)}`, ({ signalled }) => {
      expect(signalled).toBe(signalledSetting);
    });
  });

  describe("an environment without CI", () => {
    const it = test.extend("signalled", () =>
      Effect.runPromise(
        continuousIntegration.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} })),
        ),
      ));

    it("reads as false", ({ signalled }) => {
      expect(signalled).toBe(false);
    });
  });

  describe.for(["yes", "TRUE", "on"])("a rejected CI=%s", (spelling) => {
    const it = test.extend("refusal", () =>
      Effect.runPromise(
        continuousIntegration.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: { CI: spelling } }),
          ),
          Effect.flip,
          Effect.map(String),
        ),
      ));

    it("fails naming the variable", ({ refusal }) => {
      expect(refusal).toBe(
        `ConfigError(SchemaError(Expected "1" | "true" | "0" | "false"\n  at ["CI"]))`,
      );
    });
  });
});

describe("telemetrySettings", () => {
  describe.for([
    [{ MST_TELEMETRY: "1" }, true],
    [{ MST_TELEMETRY: "true" }, true],
    [{ MST_TELEMETRY: "0" }, false],
    [{ MST_TELEMETRY: "false" }, false],
    [{ MST_TELEMETRY: "" }, false],
    [{ MST_TELEMETRY: "1", OTEL_SDK_DISABLED: "true" }, false],
    [{ MST_TELEMETRY: "1", OTEL_SDK_DISABLED: "0" }, true],
  ] as const)("%o", ([environment, measuredSetting]) => {
    const it = test.extend("measured", () =>
      Effect.runPromise(
        telemetrySettings.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: environment }),
          ),
          Effect.map((settings) => settings.measured),
        ),
      ));

    it(`measures: ${String(measuredSetting)}`, ({ measured }) => {
      expect(measured).toBe(measuredSetting);
    });
  });

  describe.for([
    [
      "MST_TELEMETRY",
      { MST_TELEMETRY: "yes" },
      `ConfigError(SchemaError(Expected "1" | "true" | "0" | "false"\n  at ["MST_TELEMETRY"]))`,
    ],
    [
      "OTEL_SDK_DISABLED",
      { MST_TELEMETRY: "1", OTEL_SDK_DISABLED: "yes" },
      `ConfigError(SchemaError(Expected "1" | "true" | "0" | "false"\n  at ["OTEL_SDK_DISABLED"]))`,
    ],
    [
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      { MST_TELEMETRY: "1", OTEL_EXPORTER_OTLP_ENDPOINT: "not a url" },
      `ConfigError(SchemaError(Expected an absolute URL\n  at ["OTEL_EXPORTER_OTLP_ENDPOINT"]))`,
    ],
    [
      "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
      { MST_TELEMETRY: "1", OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "localhost" },
      `ConfigError(SchemaError(Expected an absolute URL\n  at ["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"]))`,
    ],
  ] as const)("an invalid %s", ([variable, environment, refusalMessage]) => {
    const it = test.extend("refusal", () =>
      Effect.runPromise(
        telemetrySettings.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({ env: environment }),
          ),
          Effect.flip,
          Effect.map(String),
        ),
      ));

    it(`fails naming ${variable}`, ({ refusal }) => {
      expect(refusal).toBe(refusalMessage);
    });
  });

  describe("a shared endpoint with a trailing slash", () => {
    const it = test.extend("settings", () =>
      Effect.runPromise(
        telemetrySettings.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                MST_TELEMETRY: "1",
                OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318/",
                OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "http://127.0.0.1:4319/logs",
              },
            }),
          ),
        ),
      ));

    it("derives each signal's endpoint unless the signal names its own", ({ settings }) => {
      expect(settings).toStrictEqual({
        measured: true,
        logs: "http://127.0.0.1:4319/logs",
        metrics: "http://127.0.0.1:4318/v1/metrics",
        traces: "http://127.0.0.1:4318/v1/traces",
      });
    });
  });
});

describe("inheritedEnvironment", () => {
  describe("a process carrying a set, an empty and an unset variable", () => {
    const it = test.extend("childEnvironment", () =>
      inheritedEnvironment({
        TEMPLATE_CARRIED: "carried",
        TEMPLATE_EMPTY: "",
        TEMPLATE_UNSET: undefined,
      }));

    it("hands on only the set variable, as the settings read empty as unset", ({
      childEnvironment,
    }) => {
      expect(childEnvironment).toStrictEqual({ TEMPLATE_CARRIED: "carried" });
    });
  });
});
