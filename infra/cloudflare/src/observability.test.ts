import { describe, expect, it } from "vite-plus/test";
import { workerObservability } from "./observability.ts";

describe("worker observability policy", () => {
  it("app and budget Workers keep structured logs and every trace, continuing browser trace context", () => {
    expect.hasAssertions();
    expect(workerObservability).toStrictEqual({
      enabled: true,
      headSamplingRate: 1,
      logs: { enabled: true, headSamplingRate: 1, invocationLogs: false },
      traces: { enabled: true, headSamplingRate: 1, propagationPolicy: "accept" },
    });
  });
});
