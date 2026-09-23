import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, test } from "vite-plus/test";

describe("missing database rows", () => {
  const it = test.extend("nullCoalescingSources", () => {
    const sourceDirectory = path.join(repositoryRoot, "libs/db/src");
    return readdirSync(sourceDirectory)
      .filter((sourceFile) => sourceFile.endsWith(".ts") && !sourceFile.includes(".test."))
      .filter((sourceFile) =>
        /\?\?\s*null\b/u.test(readFileSync(path.join(sourceDirectory, sourceFile), "utf-8")),
      );
  });

  it("are never coalesced to null", ({ nullCoalescingSources }) => {
    expect(nullCoalescingSources).toStrictEqual([]);
  });
});
