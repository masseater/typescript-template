import { describe, expect, it } from "vite-plus/test";
import { reported } from "./lint-harness.ts";

const effectFailures = [
  [
    "libs/shared/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => { if (Effect) throw new Error("x"); };',
  ],
  [
    "infra/budget-monitor/src/probe.ts",
    'import { Effect } from "effect"; export const run = () => { try { return Effect; } catch { return undefined; } };',
  ],
  [
    "tools/dev/src/probe.ts",
    'import { Effect } from "effect"; export const run = Effect.sync(() => process.stderr.write("x"));',
  ],
] as const;

describe("project lint rules on effect programs", () => {
  it.for(effectFailures)("rejects effect-less failure or output handling in %s", ([name, code]) => {
    expect.hasAssertions();
    expect(reported("effect-failures", name, code)).toBe(true);
  });

  it("allows standard stream writes outside effect programs", () => {
    expect.hasAssertions();
    expect(
      reported("effect-failures", "tools/dev/src/probe.ts", 'process.stdout.write("x");'),
    ).toBe(false);
  });
});
