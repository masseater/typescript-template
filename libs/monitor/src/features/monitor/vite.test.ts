import { effectDiagnostics, lifecycle, modularBoundaries, taskInput } from "@repo/vite-config";
import { describe, expect, test } from "vite-plus/test";

import { monitorWorkerVite } from "./vite.ts";

describe("monitorWorkerVite", () => {
  const it = test.extend("workerVite", () => monitorWorkerVite("error-monitor"));

  it("packs each monitor from its feature worker and builds that artifact before the pull request gate", ({
    workerVite,
  }) => {
    expect(workerVite).toStrictEqual({
      pack: {
        deps: {
          alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
          onlyBundle: ["effect", "@repo/monitor"],
        },
        dts: false,
        entry: { index: "src/features/error-monitor/worker.ts" },
        format: "esm",
        outExtensions: workerVite.pack.outExtensions,
        platform: "browser",
        target: "es2023",
      },
      run: {
        tasks: {
          ...effectDiagnostics,
          ...modularBoundaries,
          build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
          ...lifecycle({
            prepush: ["check:effect", "check:modular"],
            prepr: ["build"],
          }),
        },
      },
      test: {
        coverage: {
          exclude: ["specs/**"],
          thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
        },
        mockReset: true,
        restoreMocks: true,
      },
    });
  });
});

describe("the pack extension", () => {
  const it = test.extend("packedExtension", () => {
    const { outExtensions } = monitorWorkerVite("error-monitor").pack;
    if (outExtensions === undefined) {
      throw new Error("monitorWorkerVite pack must declare outExtensions");
    }
    return outExtensions({ format: "es", options: {} } as never);
  });

  it("emits JavaScript", ({ packedExtension }) => {
    expect(packedExtension).toStrictEqual({ js: ".js" });
  });
});
