import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { deploymentCredentials } from "./credentials.ts";

const unusablePrefix = "NOT-A-DEPLOYABLE-PREFIX";
const project = "template-project";

const environment = process.env;

interface Fixture {
  readonly filename: string;
  readonly root: string;
}

const restore = (entries: Readonly<Record<string, string | undefined>>): void => {
  for (const [name, value] of Object.entries(entries)) {
    delete environment[name];
    Object.assign(environment, value === undefined ? {} : { [name]: value });
  }
};

const withFixture = async (scenario: (fixture: Fixture) => Promise<void>): Promise<void> => {
  const previous = {
    TEMPLATE_CLOUDFLARE_ENV_FILE: environment.TEMPLATE_CLOUDFLARE_ENV_FILE,
    XDG_CONFIG_HOME: environment.XDG_CONFIG_HOME,
  };
  const root = await mkdtemp(path.join(tmpdir(), "template-credentials-"));
  const home = await mkdtemp(path.join(tmpdir(), "template-config-"));
  restore({ TEMPLATE_CLOUDFLARE_ENV_FILE: undefined, XDG_CONFIG_HOME: home });
  try {
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: project }));
    await scenario({ filename: path.join(home, project, "cloudflare.env"), root });
  } finally {
    restore(previous);
    await rm(root, { force: true, recursive: true });
    await rm(home, { force: true, recursive: true });
  }
};

const writeCredentials = async (filename: string, contents: string): Promise<void> => {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, contents);
};

const report = async (root: string): Promise<Readonly<Record<string, unknown>>> => {
  const failure = await Effect.runPromise(Effect.flip(deploymentCredentials(root)));
  return failure.report;
};

describe("deployment credentials the staged-diff check scans for", () => {
  it("reports no credentials configured when the default file was never created", async () => {
    expect.assertions(1);
    await withFixture(async ({ root }) => {
      await expect(Effect.runPromise(deploymentCredentials(root))).resolves.toStrictEqual({
        source: "absent",
        values: [],
      });
    });
  });

  it("reads the file the deploy command resolves", async () => {
    expect.assertions(1);
    await withFixture(async ({ filename, root }) => {
      await writeCredentials(filename, `TEMPLATE_PREFIX="${unusablePrefix}"\nBUDGET_JPY=5000\n`);
      await expect(Effect.runPromise(deploymentCredentials(root))).resolves.toStrictEqual({
        source: "file",
        values: [{ key: "TEMPLATE_PREFIX", value: unusablePrefix }],
      });
    });
  });

  it("keeps the credentials path out of what it reports", async () => {
    expect.assertions(1);
    await withFixture(async ({ filename, root }) => {
      restore({ TEMPLATE_CLOUDFLARE_ENV_FILE: filename });
      expect(JSON.stringify(await report(root))).not.toContain(path.dirname(filename));
    });
  });
});

describe("deployment credentials that cannot be scanned", () => {
  it("refuses to pass when the configured file is not there", async () => {
    expect.assertions(1);
    await withFixture(async ({ filename, root }) => {
      restore({ TEMPLATE_CLOUDFLARE_ENV_FILE: filename });
      await expect(report(root)).resolves.toStrictEqual({
        code: "ENOENT",
        reason: "credentials-unreadable",
      });
    });
  });

  it("refuses to pass when the file is there but cannot be read", async () => {
    expect.assertions(1);
    await withFixture(async ({ filename, root }) => {
      await mkdir(filename, { recursive: true });
      await expect(report(root)).resolves.toStrictEqual({
        code: "EISDIR",
        reason: "credentials-unreadable",
      });
    });
  });

  it("refuses to pass when the file holds no deployment value to scan for", async () => {
    expect.assertions(1);
    await withFixture(async ({ filename, root }) => {
      await writeCredentials(filename, "BUDGET_JPY=5000\n# nothing private here\n");
      await expect(report(root)).resolves.toStrictEqual({ reason: "credentials-without-values" });
    });
  });

  it("refuses to pass when the project manifest cannot be read", async () => {
    expect.assertions(1);
    await withFixture(async ({ root }) => {
      await rm(path.join(root, "package.json"));
      await expect(report(root)).resolves.toStrictEqual({
        code: "ENOENT",
        reason: "manifest-unreadable",
      });
    });
  });
});
