import { describe, expect, it } from "vite-plus/test";

import { pageItems } from "./page-items";

describe("pagination items without gaps", () => {
  it("lists every page when there are few", () => {
    expect.hasAssertions();
    expect(pageItems({ current: 1, last: 1 })).toStrictEqual([{ kind: "page", page: 1 }]);
    expect(pageItems({ current: 4, last: 7 })).toStrictEqual([
      { kind: "page", page: 1 },
      { kind: "page", page: 2 },
      { kind: "page", page: 3 },
      { kind: "page", page: 4 },
      { kind: "page", page: 5 },
      { kind: "page", page: 6 },
      { kind: "page", page: 7 },
    ]);
  });

  it("returns no items when there are no pages", () => {
    expect.hasAssertions();
    expect(pageItems({ current: 1, last: 0 })).toStrictEqual([]);
  });
});

describe("pagination items with gaps", () => {
  it("collapses distant pages into gaps around the current page", () => {
    expect.hasAssertions();
    expect(pageItems({ current: 1, last: 10 })).toStrictEqual([
      { kind: "page", page: 1 },
      { kind: "page", page: 2 },
      { kind: "page", page: 3 },
      { after: 3, kind: "gap" },
      { kind: "page", page: 10 },
    ]);
    expect(pageItems({ current: 5, last: 10 })).toStrictEqual([
      { kind: "page", page: 1 },
      { after: 1, kind: "gap" },
      { kind: "page", page: 4 },
      { kind: "page", page: 5 },
      { kind: "page", page: 6 },
      { after: 6, kind: "gap" },
      { kind: "page", page: 10 },
    ]);
    expect(pageItems({ current: 10, last: 10 })).toStrictEqual([
      { kind: "page", page: 1 },
      { after: 1, kind: "gap" },
      { kind: "page", page: 8 },
      { kind: "page", page: 9 },
      { kind: "page", page: 10 },
    ]);
  });
});

describe("pagination gap boundaries", () => {
  it("does not hide a single page behind a gap", () => {
    expect.hasAssertions();
    expect(pageItems({ current: 4, last: 10 })).toStrictEqual([
      { kind: "page", page: 1 },
      { kind: "page", page: 2 },
      { kind: "page", page: 3 },
      { kind: "page", page: 4 },
      { kind: "page", page: 5 },
      { after: 5, kind: "gap" },
      { kind: "page", page: 10 },
    ]);
    expect(pageItems({ current: 7, last: 10 })).toStrictEqual([
      { kind: "page", page: 1 },
      { after: 1, kind: "gap" },
      { kind: "page", page: 6 },
      { kind: "page", page: 7 },
      { kind: "page", page: 8 },
      { kind: "page", page: 9 },
      { kind: "page", page: 10 },
    ]);
  });
});
