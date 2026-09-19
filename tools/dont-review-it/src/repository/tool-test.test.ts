import { toolTest } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

describe("toolTest", () => {
  it("keeps the shared tool vitest isolation and coverage shape", () => {
    expect(toolTest).toStrictEqual({
      mockReset: true,
      restoreMocks: true,
      coverage: {
        exclude: ["specs/**"],
        thresholds: { 100: true, perFile: true },
      },
      unstubEnvs: true,
      unstubGlobals: true,
    });
  });
});
