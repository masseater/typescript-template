import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vite-plus/test";

test("real Pulumi SDK and Cloudflare SDK run under tsx without loading a TypeScript compiler", async () => {
  const result = await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "src/runtime-probe.ts"],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { PATH: process.env["PATH"], PULUMI_NODEJS_TYPESCRIPT: "false" },
      timeout: 20_000,
    },
  );
  expect(JSON.parse(result.stdout)).toEqual({
    event: "pulumi.runtime_verified",
    compilerLoaded: false,
    secretPreserved: true,
  });
});

test.each([
  "../shared/Pulumi.yaml",
  "../user/Pulumi.yaml",
  "../admin/Pulumi.yaml",
  "../../bootstrap/Pulumi.yaml",
])("%s disables Pulumi compiler loading and uses tsx", async (filename) => {
  const yaml = await readFile(new URL(filename, import.meta.url), "utf8");
  expect(yaml).toContain("typescript: false");
  expect(yaml).toContain("nodeargs: --import tsx");
});
