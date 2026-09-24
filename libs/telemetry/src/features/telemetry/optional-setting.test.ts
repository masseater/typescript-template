import { telemetryEnv } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

import { ENABLE_VARIABLE } from "./optional-setting.ts";

describe("the switch that asks for telemetry", () => {
  it("reaches the processes cached tasks start", () => {
    expect(telemetryEnv).toStrictEqual([
      ENABLE_VARIABLE,
      "OTEL_*",
      "TRACEPARENT",
      "TRACESTATE",
      "BAGGAGE",
    ]);
  });
});
