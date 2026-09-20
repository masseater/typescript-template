import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { SearchKeyword, laterPage, maximumKeywordLength } from "./member.ts";

const lastPage = 1000;
const numericKeyword = 2026;
const fractionalPage = 1.5;
const secondPage = 2;
const nullKeyword: unknown = JSON.parse("null");

const keyword = Schema.decodeUnknownOption(SearchKeyword);
const page = Schema.decodeUnknownOption(laterPage(lastPage));

describe("text a url search holds", () => {
  it.for([numericKeyword, true])("reads the JSON scalar %o back as text", (raw) => {
    expect.hasAssertions();
    expect(keyword(raw)).toStrictEqual(Option.some(String(raw)));
  });

  it("reads the empty JSON scalar back as text too", () => {
    expect.hasAssertions();
    expect(keyword(nullKeyword)).toStrictEqual(Option.some("null"));
  });

  it("trims the text and rejects what is left empty or too long", () => {
    expect.hasAssertions();
    expect(keyword(" 花子 ")).toStrictEqual(Option.some("花子"));
    expect(keyword("   ")).toStrictEqual(Option.none());
    expect(keyword("あ".repeat(maximumKeywordLength + 1))).toStrictEqual(Option.none());
  });

  it("rejects what a url search cannot hold as one scalar", () => {
    expect.hasAssertions();
    expect(keyword(["a"])).toStrictEqual(Option.none());
    expect(keyword({ nested: true })).toStrictEqual(Option.none());
  });
});

describe("page number a url search holds", () => {
  it("reads the number the url parser leaves as text", () => {
    expect.hasAssertions();
    expect(page(String(secondPage))).toStrictEqual(Option.some(secondPage));
  });

  it("stops at the last page the caller allows", () => {
    expect.hasAssertions();
    expect(page(lastPage)).toStrictEqual(Option.some(lastPage));
    expect(page(lastPage + 1)).toStrictEqual(Option.none());
  });

  it.for([1, 0, fractionalPage, "abc", Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %o, which the url writes as no page at all",
    (raw) => {
      expect.hasAssertions();
      expect(page(raw)).toStrictEqual(Option.none());
    },
  );
});
