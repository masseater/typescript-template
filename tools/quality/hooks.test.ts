import { describe, expect, it } from "vitest";
import { root, runCommand, withProbeDirectory } from "./lint-harness.ts";
import path from "node:path";
import { writeFile } from "node:fs/promises";

describe("git hooks", () => {
  it("pre-commit hook rejects an actual lint violation", async () => {
    expect.hasAssertions();
    const result = await withProbeDirectory(async (directory) => {
      await writeFile(path.join(directory, "invalid.ts"), "debugger;\n");
      return runCommand("fish", [path.join(root, ".githooks/pre-commit")], directory);
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("error");
  });

  it("pre-push hook rejects an actual failing test", async () => {
    expect.hasAssertions();
    const vitestEntry = import.meta.resolve("vitest");
    const result = await withProbeDirectory(async (directory) => {
      await writeFile(
        path.join(directory, "failure.test.ts"),
        `import { test, expect } from ${JSON.stringify(vitestEntry)}; test("intentional failure", () => expect(1).toBe(2));`,
      );
      return runCommand("fish", [path.join(root, ".githooks/pre-push")], directory);
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("intentional failure");
  });
});
