import { describe, expect, it } from "vite-plus/test";
import { laterPage, searchNormalizer, searchText } from "./search-params";
import { Schema } from "effect";

const keywordLimit = 100;
const lastPage = 1000;
const numericKeyword = 2026;
const fractionalPage = 1.5;
const nullKeyword: unknown = JSON.parse('{"keyword":null}');

const Keyword = Schema.Trim.check(Schema.isLengthBetween(1, keywordLimit));

const normalize = searchNormalizer({
  keyword: searchText(Keyword),
  page: laterPage(lastPage),
});

const normalizeUnbounded = searchNormalizer({ page: laterPage() });

describe("url search normalization", () => {
  it("keeps the keys it knows and drops the rest", () => {
    expect.hasAssertions();
    expect(normalize({ extra: "x", keyword: " 花子 ", page: 3 })).toStrictEqual({
      keyword: "花子",
      page: 3,
    });
  });

  it("answers with no condition at all when the search is not a record", () => {
    expect.hasAssertions();
    expect(normalize("not a record")).toStrictEqual({});
  });
});

describe("text in the url search", () => {
  it.for([numericKeyword, true])("turns the JSON scalar %o back into text", (raw) => {
    expect.hasAssertions();
    expect(normalize({ keyword: raw })).toStrictEqual({ keyword: String(raw) });
  });

  it("turns the empty JSON scalar a URL holds back into text", () => {
    expect.hasAssertions();
    expect(normalize(nullKeyword)).toStrictEqual({ keyword: "null" });
  });

  it.for(["", "   "])("drops the keyword %o because it holds no text", (keyword) => {
    expect.hasAssertions();
    expect(normalize({ keyword })).toStrictEqual({});
  });

  it("drops a keyword that is not a JSON scalar", () => {
    expect.hasAssertions();
    expect(normalize({ keyword: ["a"] })).toStrictEqual({});
    expect(normalize({ keyword: { nested: true } })).toStrictEqual({});
  });

  it("drops a keyword the schema rejects", () => {
    expect.hasAssertions();
    expect(normalize({ keyword: "あ".repeat(keywordLimit + 1) })).toStrictEqual({});
  });
});

describe("page number in the url search", () => {
  it("reads the page a hand-written URL leaves as text", () => {
    expect.hasAssertions();
    expect(normalize({ page: "2" })).toStrictEqual({ page: 2 });
  });

  it("keeps the last page the caller allows and drops the one after it", () => {
    expect.hasAssertions();
    expect(normalize({ page: lastPage })).toStrictEqual({ page: lastPage });
    expect(normalize({ page: lastPage + 1 })).toStrictEqual({});
  });

  it("leaves the page unbounded when no maximum is given", () => {
    expect.hasAssertions();
    expect(normalizeUnbounded({ page: lastPage + 1 })).toStrictEqual({ page: lastPage + 1 });
  });

  it.for([1, 0, fractionalPage, "abc", Number.NaN, Number.POSITIVE_INFINITY])(
    "treats the page %o as the first page, which the URL leaves out",
    (page) => {
      expect.hasAssertions();
      expect(normalize({ page })).toStrictEqual({});
    },
  );
});
