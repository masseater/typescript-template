import { oxlint as lintRuleAuthoringOxlint } from "@repo/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { oxfmt } from "./oxfmt.ts";
import { oxlintFor } from "./oxlint.ts";
import { dontReviewItPreset } from "./preset.ts";
import { withGitExcludes } from "./with-git-excludes.ts";

const CALLER_RULES = { rules: { eqeqeq: "error" } } as const;

describe("dontReviewItPreset.fmt", () => {
  describe("a call that adds nothing of its own", () => {
    const it = test.extend("formatting", () => dontReviewItPreset.fmt());

    it("hands over the formatting choices with what git is told to ignore", ({ formatting }) => {
      expect(formatting).toStrictEqual(withGitExcludes({ ...oxfmt }));
    });
  });

  describe("a call that adds a wrapping of its own", () => {
    const it = test.extend("formatting", () => dontReviewItPreset.fmt({ proseWrap: "always" }));

    it("lays the caller's wrapping over the one the preset decides", ({ formatting }) => {
      expect(formatting).toStrictEqual(withGitExcludes({ ...oxfmt, proseWrap: "always" }));
    });
  });

  describe("a call that adds ignored paths of its own", () => {
    const it = test.extend("formatting", () =>
      dontReviewItPreset.fmt({ ignorePatterns: ["**/generated.ts"] }));

    it("keeps the paths the preset ignores and adds the caller's after them", ({ formatting }) => {
      expect(formatting.ignorePatterns?.slice(-2)).toStrictEqual([
        "**/docs/lint/*.md",
        "**/generated.ts",
      ]);
    });
  });
});

describe("dontReviewItPreset.lint", () => {
  describe("a call that extends nothing of its own", () => {
    const it = test.extend("linting", () => dontReviewItPreset.lint({ bundles: [] }));

    it("extends the two configurations the preset brings", ({ linting }) => {
      expect(linting).toStrictEqual(
        withGitExcludes({ extends: [lintRuleAuthoringOxlint, oxlintFor([])] }),
      );
    });
  });

  describe("a call that extends a configuration of its own", () => {
    const it = test.extend("linting", () =>
      dontReviewItPreset.lint({ bundles: [], extends: [CALLER_RULES] }));

    it("puts the caller's configuration behind the ones the preset brings", ({ linting }) => {
      expect(linting).toStrictEqual(
        withGitExcludes({ extends: [lintRuleAuthoringOxlint, oxlintFor([]), CALLER_RULES] }),
      );
    });
  });
});
