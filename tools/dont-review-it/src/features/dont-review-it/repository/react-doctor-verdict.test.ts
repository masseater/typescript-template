import { describe, expect, it } from "vite-plus/test";

import { reactDoctorPassed } from "./react-doctor-verdict.ts";

const clean = {
  error: undefined,
  failed: false,
  findings: [],
  missing: [],
  projects: 3,
  skipped: [],
  unclassified: [],
} as const;

describe("react-doctor verdict", () => {
  it("passes a scan of every project with nothing to report", () => {
    expect.hasAssertions();
    expect(reactDoctorPassed(clean)).toBe(true);
  });

  it.for([
    ["a failed process", { failed: true }],
    ["a scanner error", { error: "Project discovery failed" }],
    ["a finding", { findings: ["error react-doctor/no-danger @repo/ui/src/card.tsx:4 Avoid"] }],
    ["a missing application", { missing: ["@repo/service-member"] }],
    ["no scanned project", { projects: 0 }],
    ["a skipped check", { skipped: ["@repo/ui dead-code Parse failed"] }],
    ["an unclassified rule", { unclassified: ["react-doctor/no-danger default warn"] }],
  ] as const)("fails on %s", ([, deviation]) => {
    expect.hasAssertions();
    expect(reactDoctorPassed({ ...clean, ...deviation })).toBe(false);
  });
});
