import { describe, expect, it } from "vite-plus/test";

import { deploymentValues, prefixScan, secretViolations } from "./secrets.ts";

import type { DeploymentValue, PrefixScan } from "./secrets.ts";

const unusablePrefix = "NOT-A-DEPLOYABLE-PREFIX";

const awsAccessKeyBodyLength = 16;
const githubTokenMinimumBodyLength = 36;
const source = "infra/cloudflare/src/app.ts";
const prefixValues = deploymentValues(`TEMPLATE_PREFIX="${unusablePrefix}"\n`);

function violations(
  staged: Readonly<{ content: string; filename: string }>,
  values: readonly DeploymentValue[] = prefixValues,
  scan: PrefixScan = "separated",
): string[] {
  return secretViolations(staged, values, scan);
}

describe("staged secret detection", () => {
  it.for([
    ".dev.vars",
    "apps/user/.env",
    "apps/admin/.dev.vars.preview",
    ".local/runtime.json",
    ".local-agents/credentials.json",
  ])("rejects staging private configuration: %s", (filename) => {
    expect.assertions(1);
    expect(violations({ content: "example", filename }, [])).toContain("private-file");
  });

  it("permits a public template and detects credential material", () => {
    expect.hasAssertions();
    const material = [
      [".env.example", "APP_ORIGIN=https://example.test", []],
      ["source.ts", ["-----BEGIN ", "OPENSSH PRIVATE KEY-----"].join(""), ["private-key"]],
      ["source.ts", `AKIA${"A".repeat(awsAccessKeyBodyLength)}`, ["aws-access-key"]],
      ["source.ts", `ghp_${"a".repeat(githubTokenMinimumBodyLength)}`, ["github-token"]],
    ] as const;
    for (const [filename, content, expected] of material) {
      expect(violations({ content, filename }, [])).toStrictEqual(expected);
    }
  });
});

describe("deployment prefixes written into the tree", () => {
  it.for([
    `const db = "${unusablePrefix}-db";`,
    `export const worker = "${unusablePrefix}-user";`,
    `const origin = "https://${unusablePrefix}-app.example.com";`,
    `Cannot adopt resource 'template-user/${unusablePrefix}/Worker'`,
    `--stage ${unusablePrefix}-x`,
  ])("detects a name or path built from the prefix: %s", (content) => {
    expect.assertions(1);
    expect(violations({ content, filename: source })).toStrictEqual([
      "deployment-value:TEMPLATE_PREFIX",
    ]);
  });

  it.for([
    `const placement = "${unusablePrefix}corp";`,
    `import { x } from "./${unusablePrefix}ish";`,
    `const y = "b${unusablePrefix}";`,
    `describe("${unusablePrefix}", () => {});`,
    `const file = "${unusablePrefix}.ts";`,
    `const nested = "other-${unusablePrefix}-thing";`,
  ])("leaves an ordinary word that merely contains it alone: %s", (content) => {
    expect.assertions(1);
    expect(violations({ content, filename: source })).toStrictEqual([]);
  });

  it("detects the bare word too when the tree never uses it as one", () => {
    expect.hasAssertions();
    expect(prefixScan(prefixValues, ["nothing related here"])).toBe("word");
    expect(prefixScan(prefixValues, [`a ${unusablePrefix} word`])).toBe("separated");
    const bare = `describe("${unusablePrefix}", () => {});`;
    expect(violations({ content: bare, filename: source }, prefixValues, "word")).toStrictEqual([
      "deployment-value:TEMPLATE_PREFIX",
    ]);
  });
});

describe("deployment value leaks", () => {
  it("names the key whose value was found without printing the value", () => {
    expect.hasAssertions();
    const values = deploymentValues(
      [
        "CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef",
        `TEMPLATE_PREFIX="${unusablePrefix}"`,
        "TEMPLATE_USER_ORIGIN=https://app.deployment.example",
        "BUDGET_JPY=5000",
        "TEMPLATE_JPY_PER_USD=150",
        "UNRELATED=some-other-value",
        "# comment",
      ].join("\n"),
    );
    expect(values).toStrictEqual([
      { key: "CLOUDFLARE_ACCOUNT_ID", value: "0123456789abcdef0123456789abcdef" },
      { key: "TEMPLATE_PREFIX", value: unusablePrefix },
      { key: "TEMPLATE_USER_ORIGIN", value: "https://app.deployment.example" },
    ]);
    expect(
      violations({ content: `const p = "${unusablePrefix}-db";`, filename: source }, values),
    ).toStrictEqual(["deployment-value:TEMPLATE_PREFIX"]);
    expect(
      violations({ content: "const p = config.prefix;", filename: source }, values),
    ).toStrictEqual([]);
  });
});
