import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";

describe("pull request check scope", () => {
  it("runs downstream tests and import boundaries without --changed", () => {
    expect.hasAssertions();
    const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/check.yml"), "utf8");
    const vite = readFileSync(path.join(repositoryRoot, "vite.config.ts"), "utf8");
    expect(workflow).toContain("vp run -r prepr");
    expect(workflow).not.toContain("--changed");
    expect(workflow).not.toContain("fetch-depth:");
    expect(vite).toContain('prepr: ["check:imports", "test"]');
    expect(vite).toContain('"apps/**/*.test.ts"');
    expect(vite).toContain('"infra/**/*.test.ts"');
    expect(vite).toContain('"libs/**/*.test.ts"');
  });

  it("records a stuck pull-request check as a failure before the runner sits pending", () => {
    expect.hasAssertions();
    const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/check.yml"), "utf8");
    expect(workflow).toMatch(
      /^ {2}check:\n {4}if: .+\n {4}runs-on: .+\n {4}timeout-minutes: 15$/mu,
    );
  });
});
