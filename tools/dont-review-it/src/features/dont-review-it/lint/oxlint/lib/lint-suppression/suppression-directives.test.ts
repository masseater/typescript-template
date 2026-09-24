import { describe, expect, test } from "vite-plus/test";

import { bareRuleNameOf, suppressionDirectiveOf } from "./suppression-directives.ts";

const DUPLICATE_TYPE_RULE = "no-split-type-authority--rename-or-unify";

describe("suppressionDirectiveOf", () => {
  describe("a comment holding a word", () => {
    const it = test.extend("directiveOfACommentHoldingAWord", () =>
      suppressionDirectiveOf({ value: " the running total" }));

    it("is no suppression", ({ directiveOfACommentHoldingAWord }) => {
      expect(directiveOfACommentHoldingAWord).toBe(null);
    });
  });

  describe("a comment that enables a rule", () => {
    const it = test.extend("directiveOfACommentThatEnables", () =>
      suppressionDirectiveOf({ value: " oxlint-enable no-console" }));

    it("is no suppression", ({ directiveOfACommentThatEnables }) => {
      expect(directiveOfACommentThatEnables).toBe(null);
    });
  });

  describe("a comment naming another kind of exemption", () => {
    const it = test.extend("directiveOfACommentNamingAnExemption", () =>
      suppressionDirectiveOf({ value: " mock-factory-exemption some-rule -- grounds" }));

    it("is no suppression", ({ directiveOfACommentNamingAnExemption }) => {
      expect(directiveOfACommentNamingAnExemption).toBe(null);
    });
  });

  describe("a doc comment that only mentions a disable spelling", () => {
    const it = test.extend("directiveOfADocCommentMentioningADisable", () =>
      suppressionDirectiveOf({ value: "* @see oxlint-disable" }));

    it("is no suppression", ({ directiveOfADocCommentMentioningADisable }) => {
      expect(directiveOfADocCommentMentioningADisable).toBe(null);
    });
  });

  describe("a next-line spelling", () => {
    const it = test.extend("directiveOfANextLineSpelling", () =>
      suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console" }));

    it("stays inside one line", ({ directiveOfANextLineSpelling }) => {
      expect(directiveOfANextLineSpelling).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: ["no-console"],
        carriesGrounds: false,
      });
    });
  });

  describe("a same-line spelling", () => {
    const it = test.extend("directiveOfASameLineSpelling", () =>
      suppressionDirectiveOf({ value: " eslint-disable-line no-console" }));

    it("stays inside one line", ({ directiveOfASameLineSpelling }) => {
      expect(directiveOfASameLineSpelling).toStrictEqual({
        spelling: "eslint-disable-line",
        coversWholeFile: false,
        ruleNames: ["no-console"],
        carriesGrounds: false,
      });
    });
  });

  describe("a bare oxlint disable spelling", () => {
    const it = test.extend("directiveOfABareOxlintSpelling", () =>
      suppressionDirectiveOf({ value: " oxlint-disable no-console" }));

    it("reaches past the line it sits on", ({ directiveOfABareOxlintSpelling }) => {
      expect(directiveOfABareOxlintSpelling).toStrictEqual({
        spelling: "oxlint-disable",
        coversWholeFile: true,
        ruleNames: ["no-console"],
        carriesGrounds: false,
      });
    });
  });

  describe("a bare eslint disable spelling", () => {
    const it = test.extend("directiveOfABareEslintSpelling", () =>
      suppressionDirectiveOf({ value: " eslint-disable " }));

    it("reaches past the line it sits on", ({ directiveOfABareEslintSpelling }) => {
      expect(directiveOfABareEslintSpelling).toStrictEqual({
        spelling: "eslint-disable",
        coversWholeFile: true,
        ruleNames: [],
        carriesGrounds: false,
      });
    });
  });

  describe("two rule names written ahead of the grounds", () => {
    const it = test.extend("directiveOfTwoRuleNamesBeforeTheGrounds", () =>
      suppressionDirectiveOf({
        value: " oxlint-disable-next-line no-console, no-empty -- the CLI prints here",
      }));

    it("sit between the spelling and the grounds separator", ({
      directiveOfTwoRuleNamesBeforeTheGrounds,
    }) => {
      expect(directiveOfTwoRuleNamesBeforeTheGrounds).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: ["no-console", "no-empty"],
        carriesGrounds: true,
      });
    });
  });

  describe("a spelling with nothing after it", () => {
    const it = test.extend("directiveOfASpellingWithNothingAfterIt", () =>
      suppressionDirectiveOf({ value: " oxlint-disable-next-line" }));

    it("names no rule", ({ directiveOfASpellingWithNothingAfterIt }) => {
      expect(directiveOfASpellingWithNothingAfterIt).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: [],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds written with nothing before the separator", () => {
    const it = test.extend("directiveOfGroundsWithNoRuleNames", () =>
      suppressionDirectiveOf({ value: " oxlint-disable-next-line -- the CLI prints here" }));

    it("name no rule", ({ directiveOfGroundsWithNoRuleNames }) => {
      expect(directiveOfGroundsWithNoRuleNames).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: [],
        carriesGrounds: true,
      });
    });
  });

  describe("a rule name spelled with a double dash", () => {
    const it = test.extend("directiveOfARuleNameSpelledWithADoubleDash", () =>
      suppressionDirectiveOf({
        value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- the generator writes both`,
      }));

    it("keeps its own name and the grounds after it count", ({
      directiveOfARuleNameSpelledWithADoubleDash,
    }) => {
      expect(directiveOfARuleNameSpelledWithADoubleDash).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: [DUPLICATE_TYPE_RULE],
        carriesGrounds: true,
      });
    });
  });

  describe("grounds holding a second separator", () => {
    const it = test.extend("directiveOfGroundsHoldingASecondSeparator", () =>
      suppressionDirectiveOf({
        value: " oxlint-disable-next-line no-console -- keep -- the second half",
      }));

    it("count as grounds", ({ directiveOfGroundsHoldingASecondSeparator }) => {
      expect(directiveOfGroundsHoldingASecondSeparator).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: ["no-console"],
        carriesGrounds: true,
      });
    });
  });

  describe("a directive written without a separator", () => {
    const it = test.extend("directiveOfARuleNameWithoutASeparator", () =>
      suppressionDirectiveOf({ value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE}` }));

    it("carries no grounds", ({ directiveOfARuleNameWithoutASeparator }) => {
      expect(directiveOfARuleNameWithoutASeparator).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: [DUPLICATE_TYPE_RULE],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds spelled as the rule name alone", () => {
    const it = test.extend("directiveOfGroundsSpelledAsTheRuleNameAlone", () =>
      suppressionDirectiveOf({
        value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE}`,
      }));

    it("carry no content", ({ directiveOfGroundsSpelledAsTheRuleNameAlone }) => {
      expect(directiveOfGroundsSpelledAsTheRuleNameAlone).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: [DUPLICATE_TYPE_RULE],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds spelled as the rule name the directive carries a plugin prefix for", () => {
    const it = test.extend("directiveOfGroundsSpelledAsThePrefixedRuleNameAlone", () =>
      suppressionDirectiveOf({
        value: ` oxlint-disable-next-line dont-review-it/${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE}.`,
      }));

    it("carry no content", ({ directiveOfGroundsSpelledAsThePrefixedRuleNameAlone }) => {
      expect(directiveOfGroundsSpelledAsThePrefixedRuleNameAlone).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: [`dont-review-it/${DUPLICATE_TYPE_RULE}`],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds spelled as a claim of a wrong report", () => {
    const it = test.extend("directiveOfGroundsClaimingAFalsePositive", () =>
      suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console -- false positive" }));

    it("carry no content", ({ directiveOfGroundsClaimingAFalsePositive }) => {
      expect(directiveOfGroundsClaimingAFalsePositive).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: ["no-console"],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds spelled as a bracketed claim of wrong reports", () => {
    const it = test.extend("directiveOfGroundsClaimingFalsePositivesInBrackets", () =>
      suppressionDirectiveOf({
        value: " oxlint-disable-next-line no-console -- (false positives)",
      }));

    it("carry no content", ({ directiveOfGroundsClaimingFalsePositivesInBrackets }) => {
      expect(directiveOfGroundsClaimingFalsePositivesInBrackets).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: ["no-console"],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds spelled as a claim of a wrong report in japanese", () => {
    const it = test.extend("directiveOfGroundsClaimingAWrongReportInJapanese", () =>
      suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console -- 誤検出" }));

    it("carry no content", ({ directiveOfGroundsClaimingAWrongReportInJapanese }) => {
      expect(directiveOfGroundsClaimingAWrongReportInJapanese).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: ["no-console"],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds holding only blanks", () => {
    const it = test.extend("directiveOfGroundsThatAreBlank", () =>
      suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console --  " }));

    it("carry no content", ({ directiveOfGroundsThatAreBlank }) => {
      expect(directiveOfGroundsThatAreBlank).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: ["no-console"],
        carriesGrounds: false,
      });
    });
  });

  describe("grounds that name the rule and then say something", () => {
    const it = test.extend("directiveOfGroundsNamingTheRuleAndThenSaying", () =>
      suppressionDirectiveOf({
        value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE} reads the generated copy`,
      }));

    it("carry content", ({ directiveOfGroundsNamingTheRuleAndThenSaying }) => {
      expect(directiveOfGroundsNamingTheRuleAndThenSaying).toStrictEqual({
        spelling: "oxlint-disable-next-line",
        coversWholeFile: false,
        ruleNames: [DUPLICATE_TYPE_RULE],
        carriesGrounds: true,
      });
    });
  });
});

describe("bareRuleNameOf", () => {
  describe("a rule name without a plugin prefix", () => {
    const it = test.extend("bareNameOfARuleWithoutAPrefix", () => bareRuleNameOf("no-console"));

    it("is its own bare name", ({ bareNameOfARuleWithoutAPrefix }) => {
      expect(bareNameOfARuleWithoutAPrefix).toBe("no-console");
    });
  });

  describe("a rule name carrying a plugin prefix", () => {
    const it = test.extend("bareNameOfARuleWithAPrefix", () =>
      bareRuleNameOf("dont-review-it/no-console"));

    it("loses the prefix", ({ bareNameOfARuleWithAPrefix }) => {
      expect(bareNameOfARuleWithAPrefix).toBe("no-console");
    });
  });
});
