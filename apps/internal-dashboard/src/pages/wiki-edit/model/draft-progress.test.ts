import { DateTime } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { draftProgress } from "./draft-progress.ts";

import type { WikiSource } from "#shared/contracts/index.ts";

const undrafted: WikiSource = {
  baseRevision: null,
  draft: null,
  markdown: "",
  path: "guide.md",
  publishable: true,
};

const drafted = (publishedUrl: string | null): WikiSource => ({
  ...undrafted,
  draft: {
    publishedUrl,
    updatedAt: DateTime.toDate(DateTime.makeUnsafe("2026-09-01T00:00:00Z")),
    version: 3,
  },
});

describe("wiki draft progress", () => {
  it("counts no version and offers no publishing before a draft is saved", () => {
    expect(draftProgress(undrafted)).toStrictEqual({
      publishable: false,
      publishedUrl: null,
      version: 0,
    });
  });

  it("offers publishing a saved draft when the wiki can publish", () => {
    expect(draftProgress(drafted(null))).toStrictEqual({
      publishable: true,
      publishedUrl: null,
      version: 3,
    });
  });

  it("withholds publishing when the wiki cannot publish", () => {
    expect(draftProgress({ ...drafted(null), publishable: false }).publishable).toBe(false);
  });

  it("carries the pull request a published draft opened", () => {
    expect(draftProgress(drafted("https://github.test/pull/1")).publishedUrl).toBe(
      "https://github.test/pull/1",
    );
  });
});
