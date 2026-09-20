import { describe, expect, test } from "vite-plus/test";

import { sanitizeAnalyticsPath } from "./sanitize-path.ts";

describe("sanitizeAnalyticsPath", () => {
  describe.for([
    ["/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890", "/users/_"],
    ["/messages/thread-123", "/messages/_"],
    ["/board/456", "/board/_"],
    ["/groups/group-789", "/groups/_"],
    ["/support/42", "/support/_"],
    ["/home", "/home"],
    ["/settings/profile", "/settings/profile"],
  ] as const)("%s", ([input, expected]) => {
    test(`becomes ${expected}`, () => {
      expect(sanitizeAnalyticsPath(input)).toBe(expected);
    });
  });
});
