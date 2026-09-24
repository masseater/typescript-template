import { describe, expect, test } from "vite-plus/test";

import packageManifest from "../../../../package.json" with { type: "json" };

describe("the package surface", () => {
  const it = test.extend("manifestExports", () => packageManifest.exports);

  it("is imported through its declared entries", ({ manifestExports }) => {
    expect(manifestExports).toStrictEqual({
      ".": "./src/features/ai-native-telemetry/index.ts",
      "./optional-setting": "./src/features/ai-native-telemetry/telemetry/optional-setting.ts",
      "./vitest-sdk": "./src/features/ai-native-telemetry/telemetry/vitest-sdk.ts",
      "./vitest-sdk-path": "./src/features/ai-native-telemetry/telemetry/vitest-sdk-path.ts",
      "./package.json": "./package.json",
    });
  });
});
