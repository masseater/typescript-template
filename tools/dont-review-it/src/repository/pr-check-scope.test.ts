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
    expect(workflow).toContain("vp run -r premerge");
    expect(workflow).toContain("pr-affected");
    expect(workflow).toContain("--fail-if-no-match");
    expect(workflow).not.toContain("--changed");
    expect(workflow).not.toContain("fetch-depth:");
    expect(workflow).not.toContain("paths-ignore");
    expect(workflow).not.toContain("paths:");
    expect(workflow).not.toMatch(/^ {6}run: vp check$/mu);
    expect(vite).toContain('premerge: ["test", "test:dev-server", "test:workers"]');
    expect(vite).not.toContain('"apps/**/*.test.ts"');
    expect(vite).not.toContain('"infra/**/*.test.ts"');
    expect(vite).not.toContain('"libs/**/*.test.ts"');
  });

  it("records a stuck pull-request check as a failure before the runner sits pending", () => {
    expect.hasAssertions();
    const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/check.yml"), "utf8");
    expect(workflow).toMatch(
      /^ {2}check:\n {4}if: .+\n {4}runs-on: .+\n {4}timeout-minutes: 15$/mu,
    );
  });
});
