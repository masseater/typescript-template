import { describe, expect, it } from "vite-plus/test";
import { secretViolations } from "./secrets.ts";

const awsAccessKeyBodyLength = 16;
const githubTokenMinimumBodyLength = 36;

describe("staged secret detection", () => {
  it.for([
    ".dev.vars",
    "apps/user/.env",
    "apps/admin/.dev.vars.preview",
    ".local/runtime.json",
    ".local-agents/credentials.json",
  ])("rejects staging private configuration: %s", (file) => {
    expect.assertions(1);
    expect(secretViolations(file, "example")).toContain("private-file");
  });

  it("permits a public template but detects credential material in any file", () => {
    expect.hasAssertions();
    expect(secretViolations(".env.example", "APP_ORIGIN=https://example.test")).toStrictEqual([]);
    expect(
      secretViolations("source.ts", ["-----BEGIN ", "OPENSSH PRIVATE KEY-----"].join("")),
    ).toStrictEqual(["private-key"]);
    expect(
      secretViolations("source.ts", `AKIA${"A".repeat(awsAccessKeyBodyLength)}`),
    ).toStrictEqual(["aws-access-key"]);
    expect(
      secretViolations("source.ts", `ghp_${"a".repeat(githubTokenMinimumBodyLength)}`),
    ).toStrictEqual(["github-token"]);
  });
});
