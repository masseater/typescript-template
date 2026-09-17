import { deploymentValues, secretViolations } from "./secrets.ts";
import { describe, expect, it } from "vite-plus/test";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { secretsFile } from "@template/config/deployment";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

async function readDeploymentValues(filename: string): Promise<string[]> {
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

async function resolvedValues(home: string, project: string): Promise<string[]> {
  restore({ TEMPLATE_CLOUDFLARE_ENV_FILE: undefined, XDG_CONFIG_HOME: home });
  return readDeploymentValues(secretsFile(project));
}

async function writeConfiguration(home: string, contents: string): Promise<void> {
  restore({ TEMPLATE_CLOUDFLARE_ENV_FILE: undefined, XDG_CONFIG_HOME: home });
  const target = secretsFile("template-project");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
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
  it("keeps values that only exist in the owner's deployment configuration out of the tree", () => {
    expect.hasAssertions();
    const values = deploymentValues(
      [
        "CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef",
        'TEMPLATE_PREFIX="acme"',
        "TEMPLATE_USER_ORIGIN=https://app.deployment.example",
        "BUDGET_JPY=5000",
        "TEMPLATE_JPY_PER_USD=150",
        "UNRELATED=some-other-value",
        "# comment",
      ].join("\n"),
    );
    expect(values).toStrictEqual([
      "0123456789abcdef0123456789abcdef",
      "acme",
      "https://app.deployment.example",
    ]);
    expect(
      secretViolations("infra/cloudflare/src/app.ts", "const p = 'acme';", values),
    ).toStrictEqual(["deployment-value"]);
    expect(
      secretViolations("infra/cloudflare/src/app.ts", "const p = config.prefix;", values),
    ).toStrictEqual([]);
  });
});

describe("deployment configuration discovery", () => {
  it("reads the file the deploy command resolves, with and without one present", async () => {
    expect.hasAssertions();
    const previous = {
      TEMPLATE_CLOUDFLARE_ENV_FILE: environment["TEMPLATE_CLOUDFLARE_ENV_FILE"],
      XDG_CONFIG_HOME: environment["XDG_CONFIG_HOME"],
    };
    const home = await mkdtemp(path.join(tmpdir(), "template-staged-"));
    await expect(resolvedValues(home, "template-project")).resolves.toStrictEqual([]);
    await writeConfiguration(home, 'TEMPLATE_PREFIX="acme"\nBUDGET_JPY=5000\n');
    await expect(resolvedValues(home, "template-project")).resolves.toStrictEqual(["acme"]);
    restore(previous);
    await rm(home, { force: true, recursive: true });
  });
});
