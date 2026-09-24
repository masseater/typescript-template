import { repositoryFile } from "@repo/config/repository-root";
import { describe, expect, test } from "vite-plus/test";

import { vitestSdkPath } from "./vitest-sdk-path.ts";

describe("the sdk path vitest is handed", () => {
  const it = test.extend("sdkPath", () => vitestSdkPath);

  it("names the sdk module file of this package on disk", ({ sdkPath }) => {
    expect(sdkPath).toBe(repositoryFile("libs/telemetry/src/features/telemetry/vitest-sdk.ts"));
  });
});
