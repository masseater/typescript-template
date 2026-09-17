import { expect, test } from "vitest";
import { workerObservability } from "./observability.ts";

test("app and budget Workers keep structured logs and every trace, continuing browser trace context", () => {
  expect(workerObservability).toEqual({
    enabled: true,
    headSamplingRate: 1,
    logs: { enabled: true, headSamplingRate: 1, invocationLogs: false },
    traces: { enabled: true, headSamplingRate: 1, propagationPolicy: "accept" },
  });
});
