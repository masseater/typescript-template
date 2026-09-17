import { expect, test } from "vite-plus/test";
import { workerObservability } from "./observability.ts";

test("app and budget Worker policy disables automatic request logging but retains structured logs", () => {
  expect(workerObservability).toEqual({
    enabled: true,
    headSamplingRate: 1,
    logs: { enabled: true, headSamplingRate: 1, invocationLogs: false },
  });
});
