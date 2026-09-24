import { describe, expect, test } from "vite-plus/test";

import { sdkFilePath } from "./vitest-sdk-path.ts";

describe("the sdk path vitest is handed", () => {
  const it = test.extend("sdkPath", () => sdkFilePath("file:///work/sdk%20home/vitest-sdk.ts"));

  it("is the absolute file path the resolved url names", ({ sdkPath }) => {
    expect(sdkPath).toBe("/work/sdk home/vitest-sdk.ts");
  });
});
