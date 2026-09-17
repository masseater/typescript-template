import { deploymentValues, secretViolations } from "./secrets.ts";
import { describe, expect, it } from "vite-plus/test";

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

  it("keeps values that only exist in the owner's deployment configuration out of the tree", () => {
    expect.hasAssertions();
    const values = deploymentValues(
      [
        "CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef",
        'TEMPLATE_PREFIX="deployment-name"',
        "TEMPLATE_USER_ORIGIN=https://app.deployment.example",
        "BUDGET_JPY=5000",
        "# comment",
      ].join("\n"),
    );
    expect(values).toStrictEqual([
      "0123456789abcdef0123456789abcdef",
      "deployment-name",
      "https://app.deployment.example",
    ]);
    expect(
      secretViolations("infra/cloudflare/src/app.ts", "const p = 'deployment-name';", values),
    ).toStrictEqual(["deployment-value"]);
    expect(
      secretViolations("infra/cloudflare/src/app.ts", "const p = config.prefix;", values),
    ).toStrictEqual([]);
  });
});
