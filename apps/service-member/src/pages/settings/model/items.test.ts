import { describe, expect, it } from "vite-plus/test";

import { settingsItems } from "./items.ts";

describe("settings items", () => {
  it("lists plan, leave and support as first-class peers of the other settings", () => {
    expect.hasAssertions();
    expect(settingsItems.map((listedSetting) => listedSetting.to)).toStrictEqual([
      "/settings/profile",
      "/settings/email",
      "/settings/notifications",
      "/settings/security",
      "/settings/interview",
      "/settings/ai",
      "/settings/plan",
      "/settings/leave",
      "/support",
    ]);
  });
});
