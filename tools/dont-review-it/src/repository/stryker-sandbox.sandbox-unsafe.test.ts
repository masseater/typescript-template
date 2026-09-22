import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

import {
  sandboxUnsafeReasons,
  sandboxUnsafeTestPattern,
  sandboxUnsafeTests,
} from "./stryker-sandbox.ts";
import configuration from "./stryker.ts";

const qualityDirectory = fileURLToPath(new URL(".", import.meta.url));

const onDiskSandboxUnsafe = (): string[] =>
  readdirSync(qualityDirectory)
    .filter((file) => file.endsWith(".sandbox-unsafe.test.ts"))
    .map((file) => `tools/dont-review-it/src/repository/${file}`)
    .toSorted();

const unmarkedSandboxUnsafe = (): string[] => {
  return readdirSync(qualityDirectory)
    .filter((file) => file.endsWith(".test.ts") && !file.endsWith(".sandbox-unsafe.test.ts"))
    .filter((file) => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      return sandboxUnsafeReasons.some((reason) => source.includes(reason));
    })
    .map((file) => `tools/dont-review-it/src/repository/${file}`)
    .toSorted();
};

describe("stryker sandbox unsafe tests", () => {
  it("derives ignorePatterns from the sandbox-unsafe test name", () => {
    expect.hasAssertions();
    expect(configuration.ignorePatterns).toContain(sandboxUnsafeTestPattern);
  });

  it("lists every sandbox-unsafe test beside the pattern", () => {
    expect.hasAssertions();
    expect(onDiskSandboxUnsafe()).toStrictEqual([...sandboxUnsafeTests].toSorted());
  });

  it("marks every test that needs the real repository layout", () => {
    expect.hasAssertions();
    expect(unmarkedSandboxUnsafe()).toStrictEqual([]);
  });
});
