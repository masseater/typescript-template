import { Option, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { SearchKeyword, laterPage, maximumKeywordLength } from "./paging.ts";

const lastPage = 1000;
const numericKeyword = 2026;
const fractionalPage = 1.5;
const secondPage = 2;
const nullKeyword: unknown = JSON.parse("null");
const unwrittenPages = [1, 0, fractionalPage, "abc", Number.NaN, Number.POSITIVE_INFINITY];

const keyword = Schema.decodeUnknownOption(SearchKeyword);
const page = Schema.decodeUnknownOption(laterPage(lastPage));

describe("text a url search holds", () => {
  const it = test
    .extend("theScalarKeywords", () =>
      [numericKeyword, true, nullKeyword].map((raw) => keyword(raw)))
    .extend("theTrimmedKeywords", () =>
      [" 花子 ", "   ", "あ".repeat(maximumKeywordLength + 1)].map((raw) => keyword(raw)),
    )
    .extend("theNestedKeywords", () => [["a"], { nested: true }].map((raw) => keyword(raw)));

  it("reads each JSON scalar back as text", ({ theScalarKeywords }) => {
    expect(theScalarKeywords).toStrictEqual([
      Option.some("2026"),
      Option.some("true"),
      Option.some("null"),
    ]);
  });

  it("trims the text and rejects what is left empty or too long", ({ theTrimmedKeywords }) => {
    expect(theTrimmedKeywords).toStrictEqual([Option.some("花子"), Option.none(), Option.none()]);
  });

  it("rejects what a url search cannot hold as one scalar", ({ theNestedKeywords }) => {
    expect(theNestedKeywords).toStrictEqual([Option.none(), Option.none()]);
  });
});

describe("page number a url search holds", () => {
  const it = test
    .extend("theTextPage", () => page(String(secondPage)))
    .extend("theBoundaryPages", () => [lastPage, lastPage + 1].map((raw) => page(raw)))
    .extend("theUnwrittenPages", () => unwrittenPages.map((raw) => page(raw)));

  it("reads the number the url parser leaves as text", ({ theTextPage }) => {
    expect(theTextPage).toStrictEqual(Option.some(secondPage));
  });

  it("stops at the last page the caller allows", ({ theBoundaryPages }) => {
    expect(theBoundaryPages).toStrictEqual([Option.some(lastPage), Option.none()]);
  });

  it("rejects what the url writes as no page at all", ({ theUnwrittenPages }) => {
    expect(theUnwrittenPages).toStrictEqual(unwrittenPages.map(() => Option.none()));
  });
});
