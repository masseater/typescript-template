import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

it.effect(
  "real Pulumi SDK and Cloudflare SDK run under tsx without loading a TypeScript compiler",
  () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        promisify(execFile)(process.execPath, ["--import", "tsx", "src/runtime-probe.ts"], {
          cwd: fileURLToPath(new URL("../", import.meta.url)),
          env: { PATH: process.env["PATH"], PULUMI_NODEJS_TYPESCRIPT: "false" },
          timeout: 20_000,
        }),
      );
      assert.deepStrictEqual(JSON.parse(result.stdout), {
        event: "pulumi.runtime_verified",
        compilerLoaded: false,
        secretPreserved: true,
      });
    }),
  { timeout: 30_000 },
);

for (const filename of [
  "../shared/Pulumi.yaml",
  "../user/Pulumi.yaml",
  "../admin/Pulumi.yaml",
  "../../bootstrap/Pulumi.yaml",
])
  it.effect(`${filename} disables Pulumi compiler loading and uses tsx`, () =>
    Effect.gen(function* () {
      const yaml = yield* Effect.promise(() =>
        readFile(new URL(filename, import.meta.url), "utf8"),
      );
      assert.include(yaml, "typescript: false");
      assert.include(yaml, "nodeargs: --import tsx");
    }),
  );
