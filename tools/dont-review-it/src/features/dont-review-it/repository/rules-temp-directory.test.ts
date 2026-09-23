import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";

const fixtureFile = "tools/dont-review-it/src/features/dont-review-it/repository/probe-fixture.ts";
const testFile = "tools/dont-review-it/src/features/dont-review-it/repository/probe.test.ts";
const productionFile = "tools/dont-review-it/src/features/dont-review-it/repository/probe.ts";

const fixedRoots = [
  [
    "join",
    'import { mkdirSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; mkdirSync(join(tmpdir(), "fixed-root"));',
  ],
  [
    "realpath",
    'import { rmSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { realpathSync } from "node:fs"; rmSync(join(realpathSync(tmpdir()), "fixed-root"), { recursive: true });',
  ],
  ["direct", 'import { tmpdir } from "node:os"; export const root = tmpdir();'],
] as const;

const uniqueRoots = [
  [
    "mkdtemp-sync",
    'import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; const root = mkdtempSync(join(tmpdir(), "probe-"));',
  ],
  [
    "mkdtemp-async",
    'import { mkdtemp } from "node:fs/promises"; import { tmpdir } from "node:os"; import { join } from "node:path"; const root = await mkdtemp(join(tmpdir(), "probe-"));',
  ],
  [
    "mkdtemp-realpath",
    'import { mkdtempSync, realpathSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; const root = mkdtempSync(join(realpathSync(tmpdir()), "probe-"));',
  ],
  [
    "mkdtemp-tmpdir-only",
    'import { mkdtemp } from "node:fs/promises"; import { tmpdir } from "node:os"; const root = await mkdtemp(tmpdir());',
  ],
] as const;

describe("temporary directories in tests and fixtures", () => {
  it.for(fixedRoots)("rejects a fixed temporary path: %s", ([_label, code]) => {
    expect.hasAssertions();
    expect(reported("temp-directory", { code, filename: testFile })).toBe(true);
    expect(reported("temp-directory", { code, filename: fixtureFile })).toBe(true);
  });

  it.for(uniqueRoots)("allows mkdtemp around tmpdir: %s", ([_label, code]) => {
    expect.assertions(1);
    expect(reported("temp-directory", { code, filename: testFile })).toBe(false);
  });

  it("leaves production code alone", () => {
    expect.assertions(1);
    const code =
      'import { mkdirSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; mkdirSync(join(tmpdir(), "fixed-root"));';
    expect(reported("temp-directory", { code, filename: productionFile })).toBe(false);
  });
});
