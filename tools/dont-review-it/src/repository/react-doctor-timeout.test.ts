import { describe, expect, it } from "vite-plus/test";

import { ANALYSIS_TIMEOUT, skippedOnlyByTimeout } from "./react-doctor-timeout.ts";

const timedOut = (project: string): string[] => [
  `${project} incomplete`,
  `${project} dead-code`,
  `${project} dead-code Maintainability analysis failed: Error: ${ANALYSIS_TIMEOUT}.\n    at settle`,
];

const fspyFailed = (project: string): string[] => [
  `${project} incomplete`,
  `${project} dead-code`,
  `${project} dead-code Maintainability analysis failed: Error: Project analysis worker exited with code null: fspy: failed to claim frame in shared memory`,
];

describe("react-doctor analysis timeouts", () => {
  it("retries when every skipped check traces back to a timed out analysis worker", () => {
    expect.hasAssertions();
    expect(
      skippedOnlyByTimeout([...timedOut("@repo/ui"), ...timedOut("@repo/service-member")]),
    ).toBe(true);
  });

  it("retries when every skipped check traces back to an fspy shared-memory failure", () => {
    expect.hasAssertions();
    expect(skippedOnlyByTimeout([...fspyFailed("@repo/ui"), ...fspyFailed("@repo/auth-ui")])).toBe(
      true,
    );
  });

  it("does not retry a clean scan", () => {
    expect.hasAssertions();
    expect(skippedOnlyByTimeout([])).toBe(false);
  });

  it("does not retry when a check was skipped for any other reason", () => {
    expect.hasAssertions();
    expect(
      skippedOnlyByTimeout([...timedOut("@repo/ui"), "@repo/service-admin dead-code Parse failed"]),
    ).toBe(false);
    expect(skippedOnlyByTimeout(["@repo/ui incomplete", "@repo/ui dead-code"])).toBe(false);
    expect(skippedOnlyByTimeout(["libs/legacy no tsconfig"])).toBe(false);
  });
});
