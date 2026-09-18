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
  importRoutes: [
    {
      exportName: "STATUSES",
      resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
      specifier: "@fixture/vocabulary",
    },
  ],
  packageName: "@fixture/vocabulary",
  values: ["draft", "published"],
};

describe("ownersVisibleFrom", () => {
  describe.for([
    ["a package the consumer depends on, published", "@fixture/vocabulary", true, true],
    ["a package the consumer depends on, unpublished", "@fixture/vocabulary", false, false],
    ["the consumer's own package, unpublished", "@fixture/app", false, true],
    ["a package the consumer does not depend on", "@fixture/unrelated", true, false],
    ["no package at all", null, false, true],
  ] as const)("an owner declared in %s", ([, ownerPackage, published, visibility]) => {
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
      })({
        ...vocabularyOwner,
        importRoutes: published ? vocabularyOwner.importRoutes : [],
        packageName: ownerPackage,
      });
    });

    it("is visible only where the consumer can import it", ({ ownerVisible }) => {
      expect(ownerVisible).toBe(visibility);
    });
  });
});
