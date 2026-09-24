import { describe, expect, it } from "vite-plus/test";

import { denialReason } from "./client-bundle-denial.ts";

const violation = (reason: string): Error =>
  new Error(
    [
      "[import-protection] Import denied in client environment",
      "",
      `  ${reason}`,
      "  Importer: src/pages/landing/ui/hero.tsx:1:1",
      '  Import: "@repo/db"',
    ].join("\n"),
  );

describe("client bundle denial reason", () => {
  it.for([
    ["Denied by file pattern: **/libs/db/src/**", "**/libs/db/src/**"],
    ["Denied by specifier pattern: @repo/auth", "@repo/auth"],
    ["Denied by marker: module is restricted to the opposite environment", "marker"],
  ] as const)("reads %s", ([reason, expected]) => {
    expect.hasAssertions();
    expect(denialReason(violation(reason))).toBe(expected);
  });

  it("names a build failure without an import-protection reason as denied", () => {
    expect.hasAssertions();
    expect(denialReason(new Error("Could not resolve entry module"))).toBe("denied");
  });
});
