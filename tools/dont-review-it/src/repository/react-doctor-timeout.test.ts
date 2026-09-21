import { describe, expect, it } from "vite-plus/test";

import {
  ANALYSIS_TIMEOUT,
  FSPY_SHARED_MEMORY,
  skippedOnlyByTimeout,
} from "./react-doctor-timeout.ts";

const timedOut = (project: string): string[] => [
  `${project} incomplete`,
  `${project} dead-code`,
  `${project} dead-code Maintainability analysis failed: Error: ${ANALYSIS_TIMEOUT}.\n    at settle`,
];

const fspyPanic = (project: string): string[] => [
  `${project} incomplete`,
  `${project} dead-code`,
  `${project} dead-code Maintainability analysis failed: Error: Project analysis worker exited with code null: thread '<unnamed>' panicked at fspy_client_unix/src/lib.rs:89:14:\n${FSPY_SHARED_MEMORY}\n`,
];

describe("react-doctor analysis timeouts", () => {
  it("retries when every skipped check traces back to a timed out analysis worker", () => {
    expect.hasAssertions();
    expect(
      skippedOnlyByTimeout([...timedOut("@repo/ui"), ...timedOut("@repo/service-member")]),
    ).toBe(true);
  });

  it("retries when every skipped check traces back to an fspy shared-memory panic", () => {
    expect.hasAssertions();
    expect(
      skippedOnlyByTimeout([...fspyPanic("@repo/ui"), ...fspyPanic("@repo/service-admin")]),
    ).toBe(true);
  });

  it("retries when timeouts and fspy panics are mixed across projects", () => {
    expect.hasAssertions();
    expect(
      skippedOnlyByTimeout([...timedOut("@repo/ui"), ...fspyPanic("@repo/service-member")]),
    ).toBe(true);
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
