import { describe, expect, it } from "vite-plus/test";

import { lastPage } from "./last-page.ts";

describe("last page", () => {
  it("keeps one page when there is nothing to show", () => {
    expect.hasAssertions();
    expect(lastPage(0, 20)).toBe(1);
  });

  it("rounds a partly filled page up", () => {
    expect.hasAssertions();
    expect(lastPage(20, 20)).toBe(1);
    expect(lastPage(21, 20)).toBe(2);
  });
});
