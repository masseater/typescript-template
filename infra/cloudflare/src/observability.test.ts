import { describe, expect, it } from "vitest";
import { workerObservability } from "./observability.ts";

describe("worker observability policy", () => {
  it("app and budget Worker policy disables automatic request logging but retains structured logs", () => {
    expect.hasAssertions();
    expect(workerObservability).toStrictEqual({
      enabled: true,
      headSamplingRate: 1,
      logs: { enabled: true, headSamplingRate: 1, invocationLogs: false },
    });
  });
});
