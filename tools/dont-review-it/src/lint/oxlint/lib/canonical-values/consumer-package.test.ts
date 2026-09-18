import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { ownersVisibleFrom } from "./consumer-package.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";

const vocabularyOwner: CanonicalValuesEntry = {
  annotationStart: 0,
  binding: "STATUSES",
  bindingStart: 0,
  conceptId: "vocabulary.status",
  declarationEnd: 0,
  declarationPath: "packages/vocabulary/src/status.ts",
  declarationStart: 0,
  fingerprint: "",
  importRoutes: [],
  packageName: "@fixture/vocabulary",
  values: ["draft", "published"],
};

describe("ownersVisibleFrom", () => {
  describe.for([
    ["a package the consumer depends on", "@fixture/vocabulary", true],
    ["the consumer's own package", "@fixture/app", true],
    ["a package the consumer does not depend on", "@fixture/unrelated", false],
    ["no package at all", null, true],
  ] as const)("an owner declared in %s", ([, ownerPackage, visibility]) => {
    const it = test.extend("ownerVisible", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "consumer-package-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { force: true, recursive: true });
      });
      mkdirSync(join(repositoryRoot, "packages/app/src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), JSON.stringify({ name: "root" }));
      writeFileSync(
        join(repositoryRoot, "packages/app/package.json"),
        JSON.stringify({
          name: "@fixture/app",
          dependencies: { "@fixture/vocabulary": "workspace:*" },
        }),
      );
      return ownersVisibleFrom({
        filename: join(repositoryRoot, "packages/app/src/view.ts"),
        repositoryRoot,
      })({ ...vocabularyOwner, packageName: ownerPackage });
    });

    it("is visible only where the consumer can import it", ({ ownerVisible }) => {
      expect(ownerVisible).toBe(visibility);
    });
  });
});
