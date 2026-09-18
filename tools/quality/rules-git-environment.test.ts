import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";

const fixtureFile = "tools/quality/probe-fixture.ts";
const testFile = "tools/quality/probe.test.ts";
const productionFile = "tools/quality/probe.ts";

const start = 'import { execFile } from "node:child_process";\n';

const inheritedEnvironment = [
  ["exec-file", `${start}execFile("git", ["init"], { cwd: root });`],
  ["no-options", `${start}execFile("git", ["init"]);`],
  ["spawn", 'import { spawn } from "node:child_process";\nspawn("git", ["init"], { cwd: root });'],
  [
    "sync",
    'import { execFileSync } from "node:child_process";\nexecFileSync("git", ["init"], { cwd: root });',
  ],
  ["promisified", `${start}const run = promisify(execFile);\nrun("git", ["init"], { cwd: root });`],
  ["absolute-path", `${start}execFile("/usr/bin/git", ["init"], { cwd: root });`],
  ["spread-options", `${start}execFile("git", ["init"], { ...options });`],
] as const;

const declaredEnvironment = [
  ["exec-file", `${start}execFile("git", ["init"], { cwd: root, env: clean });`],
  [
    "promisified",
    `${start}const run = promisify(execFile);\nrun("git", ["init"], { env: clean });`,
  ],
  [
    "inline",
    `${start}execFile("git", ["init"], { env: { GIT_CONFIG_GLOBAL: "/dev/null", PATH: "" } });`,
  ],
] as const;

describe("git started from a test or a fixture", () => {
  it.for(inheritedEnvironment)("rejects an inherited environment: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("git-environment", testFile, code)).toBe(true);
    expect(reported("git-environment", fixtureFile, code)).toBe(true);
  });

  it.for(declaredEnvironment)("allows a declared environment: %s", ([_label, code]) => {
    expect.assertions(1);
    expect(reported("git-environment", testFile, code)).toBe(false);
  });

  it("leaves the code under test alone, which must honour the hook's own variables", () => {
    expect.assertions(1);
    const code = `${start}execFile("git", ["ls-files"], { cwd: root });`;
    expect(reported("git-environment", productionFile, code)).toBe(false);
  });
});
