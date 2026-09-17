import { expect, test } from "vitest";
import { secretViolations } from "./secrets.ts";

test.for([
  ".dev.vars",
  "apps/user/.env",
  "apps/admin/.dev.vars.preview",
  ".local/runtime.json",
  ".local-agents/credentials.json",
])("rejects staging private configuration: %s", (file) => {
  expect(secretViolations(file, "example")).toContain("private-file");
});

test("permits a public template but detects credential material in any file", () => {
  expect(secretViolations(".env.example", "APP_ORIGIN=https://example.test")).toEqual([]);
  expect(
    secretViolations("source.ts", ["-----BEGIN ", "OPENSSH PRIVATE KEY-----"].join("")),
  ).toEqual(["private-key"]);
  expect(secretViolations("source.ts", "AKIA" + "A".repeat(16))).toEqual(["aws-access-key"]);
  expect(secretViolations("source.ts", "ghp_" + "a".repeat(36))).toEqual(["github-token"]);
});
