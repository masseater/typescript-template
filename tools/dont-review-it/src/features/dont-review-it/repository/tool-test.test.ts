import { toolTest } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

describe("toolTest", () => {
  it("keeps the shared tool vitest isolation and coverage shape", () => {
    expect.hasAssertions();
    expect(toolTest).toStrictEqual({
      mockReset: true,
      restoreMocks: true,
      coverage: {
        exclude: ["specs/**"],
        thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
      },
      unstubEnvs: true,
      unstubGlobals: true,
    });
  });
});
