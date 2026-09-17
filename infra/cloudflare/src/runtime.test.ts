import { describe, expect, it } from "vite-plus/test";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";
import { readEnvironment } from "./environment.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";

const PROBE_TIMEOUT_MS = 20_000;

describe("pulumi runtime", () => {
  it("real Pulumi SDK and Cloudflare SDK run under native Node type stripping without loading a TypeScript compiler", async () => {
    expect.hasAssertions();
    // oxlint-disable-next-line typescript/strict-void-return
    const result = await promisify(execFile)(process.execPath, ["src/runtime-probe.ts"], {
      cwd: `${import.meta.dirname}/..`,
      env: { PATH: readEnvironment().PATH, PULUMI_NODEJS_TYPESCRIPT: "false" },
      timeout: PROBE_TIMEOUT_MS,
    });
    expect(JSON.parse(result.stdout)).toStrictEqual({
      compilerLoaded: false,
      event: "pulumi.runtime_verified",
      secretPreserved: true,
    });
  });

  it.each([
    "../shared/Pulumi.yaml",
    "../user/Pulumi.yaml",
    "../admin/Pulumi.yaml",
    "../wiki/Pulumi.yaml",
    "../../bootstrap/Pulumi.yaml",
  ])(
    "%s disables Pulumi compiler loading and runs TypeScript with plain Node",
    async (filename) => {
      expect.hasAssertions();
      const yaml = await readFile(new URL(filename, import.meta.url), "utf-8");
      expect(yaml).toContain("typescript: false");
      expect(yaml).not.toContain("nodeargs");
    },
  );
});
