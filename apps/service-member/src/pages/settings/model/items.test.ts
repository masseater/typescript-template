import { describe, expect, it } from "vite-plus/test";

import { settingsItems } from "./items.ts";

describe("settings items", () => {
  it("lists plan and leave as first-class peers of the other settings", () => {
    expect.hasAssertions();
    expect(settingsItems.map((listedSetting) => listedSetting.to)).toStrictEqual([
      "/settings/profile",
      "/settings/notifications",
      "/settings/security",
      "/settings/interview",
      "/settings/ai",
      "/settings/plan",
      "/settings/recovery",
      "/settings/leave",
    ]);
  });
});
