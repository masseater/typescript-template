import { deploymentValues, secretViolations } from "./secrets.ts";
import { describe, expect, it } from "vite-plus/test";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { DeploymentValue } from "./secrets.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { secretsFile } from "@template/config/deployment";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const unusablePrefix = "NOT_A_DEPLOYABLE_PREFIX";

async function readDeploymentValues(filename: string): Promise<DeploymentValue[]> {
  try {
    return deploymentValues(await readFile(filename, "utf-8"));
  } catch {
    return [];
  }
}

// oxlint-disable-next-line node/no-process-env
const environment = process.env;

function restore(entries: Readonly<Record<string, string | undefined>>): void {
  for (const [name, value] of Object.entries(entries)) {
    // oxlint-disable-next-line typescript/no-dynamic-delete
    delete environment[name];
    Object.assign(environment, value === undefined ? {} : { [name]: value });
  }
}

const initialEnvironment = {
  TEMPLATE_CLOUDFLARE_ENV_FILE: environment["TEMPLATE_CLOUDFLARE_ENV_FILE"],
  XDG_CONFIG_HOME: environment["XDG_CONFIG_HOME"],
};

async function resolvedValues(home: string, project: string): Promise<DeploymentValue[]> {
  restore({ TEMPLATE_CLOUDFLARE_ENV_FILE: undefined, XDG_CONFIG_HOME: home });
  return readDeploymentValues(secretsFile(project));
}

async function writeConfiguration(home: string, contents: string): Promise<void> {
  restore({ TEMPLATE_CLOUDFLARE_ENV_FILE: undefined, XDG_CONFIG_HOME: home });
  const target = secretsFile("template-project");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function withConfigurationHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await mkdtemp(path.join(tmpdir(), "template-staged-"));
  try {
    await run(home);
  } finally {
    restore(initialEnvironment);
    await rm(home, { force: true, recursive: true });
  }
}

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

  it("permits a public template and detects credential material", () => {
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
      secretViolations("infra/cloudflare/src/app.ts", `const p = '${unusablePrefix}';`, values),
    ).toStrictEqual(["deployment-value:TEMPLATE_PREFIX"]);
    expect(
      secretViolations("infra/cloudflare/src/app.ts", "const p = config.prefix;", values),
    ).toStrictEqual([]);
  });
});

describe("deployment configuration discovery", () => {
  it("reads the file the deploy command resolves, with and without one present", async () => {
    expect.hasAssertions();
    await withConfigurationHome(async (home) => {
      await expect(resolvedValues(home, "template-project")).resolves.toStrictEqual([]);
      await writeConfiguration(home, `TEMPLATE_PREFIX="${unusablePrefix}"\nBUDGET_JPY=5000\n`);
      await expect(resolvedValues(home, "template-project")).resolves.toStrictEqual([
        { key: "TEMPLATE_PREFIX", value: unusablePrefix },
      ]);
    });
  });
});
