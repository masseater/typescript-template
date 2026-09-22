import type { UserConfig } from "vite-plus";

const toolTest: NonNullable<UserConfig["test"]> = {
  mockReset: true,
  restoreMocks: true,
  coverage: {
    exclude: ["specs/**"],
    thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
  },
  testTimeout: 30_000,
  unstubEnvs: true,
  unstubGlobals: true,
};

export { toolTest };
