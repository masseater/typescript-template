import { dateToWareki } from "@smarthr/wareki";
import { describe, expect, it } from "vitest";

import { formatWarekiDate, formatWarekiMonth } from "./wareki.ts";

describe("formatWarekiDate", () => {
  it("formats a Gregorian instant as 和暦", () => {
    expect(formatWarekiDate(new Date("2019-05-01T00:00:00Z"))).toBe(
      dateToWareki(new Date("2019-05-01T00:00:00Z")).result,
    );
  });
});

describe("formatWarekiMonth", () => {
  it("drops the day for year-month registration labels", () => {
    expect(formatWarekiMonth("2019-05")).toBe("令和元年5月");
  });
});
