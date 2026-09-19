import { describe, expect, test } from "vite-plus/test";

import { pageItems } from "./page-items.ts";

describe("pagination items without gaps", () => {
  const it = test
    .extend("theItemsOfASinglePage", () => pageItems({ current: 1, last: 1 }))
    .extend("theItemsOfSevenPages", () => pageItems({ current: 4, last: 7 }))
    .extend("theItemsOfNoPages", () => pageItems({ current: 1, last: 0 }));

  it("lists the only page", ({ theItemsOfASinglePage }) => {
    expect(theItemsOfASinglePage).toStrictEqual([{ kind: "page", page: 1 }]);
  });

  it("lists every page when there are few", ({ theItemsOfSevenPages }) => {
    expect(theItemsOfSevenPages).toStrictEqual([
      { kind: "page", page: 1 },
      { kind: "page", page: 2 },
      { kind: "page", page: 3 },
      { kind: "page", page: 4 },
      { kind: "page", page: 5 },
      { kind: "page", page: 6 },
      { kind: "page", page: 7 },
    ]);
  });

  it("returns no items when there are no pages", ({ theItemsOfNoPages }) => {
    expect(theItemsOfNoPages).toStrictEqual([]);
  });
});

describe("pagination items with gaps", () => {
  const it = test
    .extend("theItemsAroundTheFirstOfTenPages", () => pageItems({ current: 1, last: 10 }))
    .extend("theItemsAroundTheMiddleOfTenPages", () => pageItems({ current: 5, last: 10 }))
    .extend("theItemsAroundTheLastOfTenPages", () => pageItems({ current: 10, last: 10 }));

  it("collapses the pages after the first page into a gap", ({
    theItemsAroundTheFirstOfTenPages,
  }) => {
    expect(theItemsAroundTheFirstOfTenPages).toStrictEqual([
      { kind: "page", page: 1 },
      { kind: "page", page: 2 },
      { kind: "page", page: 3 },
      { after: 3, kind: "gap" },
      { kind: "page", page: 10 },
    ]);
  });

  it("collapses the pages on both sides of the current page into gaps", ({
    theItemsAroundTheMiddleOfTenPages,
  }) => {
    expect(theItemsAroundTheMiddleOfTenPages).toStrictEqual([
      { kind: "page", page: 1 },
      { after: 1, kind: "gap" },
      { kind: "page", page: 4 },
      { kind: "page", page: 5 },
      { kind: "page", page: 6 },
      { after: 6, kind: "gap" },
      { kind: "page", page: 10 },
    ]);
  });

  it("collapses the pages before the last page into a gap", ({
    theItemsAroundTheLastOfTenPages,
  }) => {
    expect(theItemsAroundTheLastOfTenPages).toStrictEqual([
      { kind: "page", page: 1 },
      { after: 1, kind: "gap" },
      { kind: "page", page: 8 },
      { kind: "page", page: 9 },
      { kind: "page", page: 10 },
    ]);
  });
});

describe("pagination gap boundaries", () => {
  const it = test
    .extend("theItemsWhoseLeadingGapWouldHideOnePage", () => pageItems({ current: 4, last: 10 }))
    .extend("theItemsWhoseTrailingGapWouldHideOnePage", () => pageItems({ current: 7, last: 10 }));

  it("does not hide a single leading page behind a gap", ({
    theItemsWhoseLeadingGapWouldHideOnePage,
  }) => {
    expect(theItemsWhoseLeadingGapWouldHideOnePage).toStrictEqual([
      { kind: "page", page: 1 },
      { kind: "page", page: 2 },
      { kind: "page", page: 3 },
      { kind: "page", page: 4 },
      { kind: "page", page: 5 },
      { after: 5, kind: "gap" },
      { kind: "page", page: 10 },
    ]);
  });

  it("does not hide a single trailing page behind a gap", ({
    theItemsWhoseTrailingGapWouldHideOnePage,
  }) => {
    expect(theItemsWhoseTrailingGapWouldHideOnePage).toStrictEqual([
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
