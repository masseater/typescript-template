import { describe, expect, it } from "vitest";
import { rankPages } from "./semantic.ts";

const PAGE_LIMIT = 5;
const SHORT_PAGE_LIMIT = 2;

describe("page ranking", () => {
  it("semantic similarity orders pages even when no keyword matches", () => {
    expect.hasAssertions();
    const semantic = [
      { score: 0.41, url: "/deploy" },
      { score: 0.63, url: "/database" },
      { score: 0.52, url: "/database" },
      { score: 0.38, url: "/authentication" },
    ];
    expect(rankPages(semantic, [], PAGE_LIMIT)).toStrictEqual([
      "/database",
      "/deploy",
      "/authentication",
    ]);
  });

  it("a close semantic second place is lifted by the top keyword match", () => {
    expect.hasAssertions();
    const semantic = [
      { score: 0.6, url: "/database" },
      { score: 0.58, url: "/deploy" },
      { score: 0.3, url: "/authentication" },
    ];
    expect(rankPages(semantic, ["/deploy"], PAGE_LIMIT)[0]).toBe("/deploy");
    expect(
      rankPages(
        [{ score: 0.9, url: "/database" }, ...semantic],
        ["/authentication"],
        PAGE_LIMIT,
      )[0],
    ).toBe("/database");
  });

  it("keyword order alone is kept when embeddings are unavailable", () => {
    expect.hasAssertions();
    expect(
      rankPages([], ["/authentication", "/database", "/deploy"], SHORT_PAGE_LIMIT),
    ).toStrictEqual(["/authentication", "/database"]);
  });
});
