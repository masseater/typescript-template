import { dateToWareki } from "@smarthr/wareki";
import { describe, expect, test } from "vite-plus/test";

import { formatWarekiDate, formatWarekiDateTime, formatWarekiMonth } from "./wareki.ts";

const reiwaStart = new Date("2019-05-01T00:00:00Z");
const lateEveningUtc = Date.UTC(2019, 4, 1, 23, 30);

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

describe("formatWarekiDateTime", () => {
  const it = test.extend("theLabelOfLateEveningUtc", () => formatWarekiDateTime(lateEveningUtc));

  it("labels the instant on the Japanese calendar day with the hour and minute", ({
    theLabelOfLateEveningUtc,
  }) => {
    expect(theLabelOfLateEveningUtc).toBe("令和元年5月2日 08:30");
  });
});
