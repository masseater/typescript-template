import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";

describe("pull request check scope", () => {
  it("runs pull request tests since the merge base and the full suite on the merge queue", () => {
    expect.hasAssertions();
    const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/check.yml"), "utf8");
    const vite = readFileSync(path.join(repositoryRoot, "vite.config.ts"), "utf8");
    expect(workflow).toContain("vp run -r prepr");
    expect(workflow).toContain("vp run -r premerge");
    expect(workflow).not.toContain("fetch-depth:");
    expect(workflow).not.toContain("--deepen");
    expect(workflow).toContain("pull request checkout is not the merge commit");
    expect(workflow).toContain("git fetch --no-tags --depth=1 origin");
    expect(workflow).toContain('refs/remotes/origin/main "${parents[0]}"');
    expect(vite).toContain('prepr: ["check:imports", "test"]');
    expect(vite).toContain('premerge: ["test:all", "test:dev-server"]');
    expect(vite).toContain("--changed origin/main --passWithNoTests");
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
