import { describe, expect, test } from "vite-plus/test";

import { packageNameOf, packageReferenceOf } from "./package-specifier.ts";

describe("packageReferenceOf", () => {
  describe("a scope written without a package name", () => {
    const it = test.extend("referenceOfBareScope", () => packageReferenceOf("@fixture"));

    it("references no package", ({ referenceOfBareScope }) => {
      expect(referenceOfBareScope).toBe(null);
    });
  });

  describe("a package written with a subpath", () => {
    const it = test.extend("referenceOfScopedSubpath", () =>
      packageReferenceOf("@fixture/shared/http"));

    it("references that subpath", ({ referenceOfScopedSubpath }) => {
      expect(referenceOfScopedSubpath).toStrictEqual({
        name: "@fixture/shared",
        subpath: "./http",
      });
    });
  });
});

describe("packageNameOf", () => {
  describe.for([
    ["an unscoped package", "effect", "effect"],
    ["a subpath of an unscoped package", "react-dom/server", "react-dom"],
    ["a subpath of a scoped package", "@repo/config/identity", "@repo/config"],
    ["a scoped package", "@repo/config", "@repo/config"],
  ] as const)("%s", ([, specifier, expected]) => {
    const it = test.extend("packageName", () => packageNameOf(specifier));

    it("is the name of the package", ({ packageName }) => {
      expect(packageName).toBe(expected);
    });
  });

  describe("a scope written without a package name", () => {
    const it = test.extend("nameOfBareScope", () => packageNameOf("@fixture"));

    it("names no package", ({ nameOfBareScope }) => {
      expect(nameOfBareScope).toBeUndefined();
    });
  });
});
