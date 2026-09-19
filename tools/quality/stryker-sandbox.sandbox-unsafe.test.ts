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
const sandboxUnsafeName = /\.sandbox-unsafe\.test\.ts$/u;

const onDiskSandboxUnsafe = (): string[] =>
  readdirSync(qualityDirectory)
    .filter((file) => sandboxUnsafeName.test(file))
    .map((file) => `tools/quality/${file}`)
    .toSorted();

const unmarkedSandboxUnsafe = (): string[] => {
  return readdirSync(qualityDirectory)
    .filter((file) => file.endsWith(".test.ts") && !sandboxUnsafeName.test(file))
    .filter((file) => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      return sandboxUnsafeReasons.some((reason) => source.includes(reason));
    })
    .map((file) => `tools/quality/${file}`)
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
