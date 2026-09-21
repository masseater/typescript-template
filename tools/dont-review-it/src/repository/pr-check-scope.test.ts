import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";

describe("pull request check scope", () => {
  it("does not fetch repository history that grows with the age of the repository", () => {
    expect.hasAssertions();
    const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/check.yml"), "utf8");
    expect(workflow).not.toMatch(/fetch-depth:\s*["']?0["']?(?![\d.])/u);
    expect(workflow).not.toContain("--deepen");
  });

  it("records a stuck pull-request check as a failure before the runner sits pending", () => {
    expect.hasAssertions();
    const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/check.yml"), "utf8");
    const checkJob = /^ {2}check:\n(?<body>.*?)(?=^ {2}\S)/msu.exec(workflow)?.groups?.["body"];
    expect(checkJob).toMatch(/^\s*timeout-minutes:\s*\d+\s*$/mu);
  });
});
