import { dateToWareki } from "@smarthr/wareki";
import { describe, expect, test } from "vite-plus/test";

import { formatWarekiDate, formatWarekiMonth } from "./wareki.ts";

const reiwaStart = new Date("2019-05-01T00:00:00Z");

describe("formatWarekiDate", () => {
  const it = test
    .extend("theWarekiLabelOfReiwaStart", () => formatWarekiDate(reiwaStart))
    .extend("theLibraryWarekiOfReiwaStart", () => dateToWareki(reiwaStart));

  it("formats a Gregorian instant as 和暦", ({
    theWarekiLabelOfReiwaStart,
    theLibraryWarekiOfReiwaStart,
  }) => {
    expect(theWarekiLabelOfReiwaStart).toBe(theLibraryWarekiOfReiwaStart.result);
  });
});

describe("formatWarekiMonth", () => {
  const it = test.extend("theWarekiMonthOfReiwaStart", () => formatWarekiMonth("2019-05"));

  it("drops the day for year-month registration labels", ({ theWarekiMonthOfReiwaStart }) => {
    expect(theWarekiMonthOfReiwaStart).toBe("令和元年5月");
  });
});
