import { describe, expect, test } from "vite-plus/test";

import { sanitizeAnalyticsPath } from "./sanitize-path.ts";

describe("sanitizeAnalyticsPath", () => {
  describe.for([
    ["/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890", "/users/_"],
    ["/messages/thread-123", "/messages/_"],
    ["/board/456", "/board/_"],
    ["/groups/group-789", "/groups/_"],
    ["/support/42", "/support/_"],
    ["/en/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890", "/en/users/_"],
    ["/en/messages/thread-123", "/en/messages/_"],
    ["/ja/board/456", "/ja/board/_"],
    ["/en/users/a1b2c3d4/photos", "/en/users/_/photos"],
    ["/home", "/home"],
    ["/en/home", "/en/home"],
    ["/en", "/en"],
    ["/settings/profile", "/settings/profile"],
  ] as const)("%s", ([input, expected]) => {
    test(`becomes ${expected}`, () => {
      expect(sanitizeAnalyticsPath(input)).toBe(expected);
    });
  });
});
