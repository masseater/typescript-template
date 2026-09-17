import { expect, test } from "vite-plus/test";
import { rankPages } from "./semantic.ts";

test("semantic similarity orders pages even when no keyword matches", () => {
  const semantic = [
    { url: "/deploy", score: 0.41 },
    { url: "/database", score: 0.63 },
    { url: "/database", score: 0.52 },
    { url: "/authentication", score: 0.38 },
  ];
  expect(rankPages(semantic, [], 5)).toEqual(["/database", "/deploy", "/authentication"]);
});

test("a close semantic second place is lifted by the top keyword match", () => {
  const semantic = [
    { url: "/database", score: 0.6 },
    { url: "/deploy", score: 0.58 },
    { url: "/authentication", score: 0.3 },
  ];
  expect(rankPages(semantic, ["/deploy"], 5)[0]).toBe("/deploy");
  expect(
    rankPages([{ url: "/database", score: 0.9 }, ...semantic], ["/authentication"], 5)[0],
  ).toBe("/database");
});

test("keyword order alone is kept when embeddings are unavailable", () => {
  expect(rankPages([], ["/authentication", "/database", "/deploy"], 2)).toEqual([
    "/authentication",
    "/database",
  ]);
});
