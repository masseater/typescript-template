import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const PROBE_TIMEOUT_MS = 20_000;

describe("pulumi runtime", () => {
  it("real Pulumi SDK and Cloudflare SDK run under tsx without loading a TypeScript compiler", async () => {
    expect.hasAssertions();
    const result = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "src/runtime-probe.ts"],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { PATH: process.env["PATH"], PULUMI_NODEJS_TYPESCRIPT: "false" },
        timeout: PROBE_TIMEOUT_MS,
      },
    );
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
    "../../bootstrap/Pulumi.yaml",
  ])("%s disables Pulumi compiler loading and uses tsx", async (filename) => {
    expect.hasAssertions();
    const yaml = await readFile(new URL(filename, import.meta.url), "utf-8");
    expect(yaml).toContain("typescript: false");
    expect(yaml).toContain("nodeargs: --import tsx");
  });
});
