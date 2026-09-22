import { describe, expect, test } from "vite-plus/test";

import { instructionOf } from "./instruction.ts";

describe("instructionOf", () => {
  describe("an open pull request whose head is behind its base", () => {
    const it = test.extend("theInstructionForABehindPullRequest", () =>
      instructionOf({
        baseRefName: "main",
        mergeStateStatus: "BEHIND",
        number: 9,
        url: "https://example.com/9",
      }));

    it("hands back the catch-up instruction", ({ theInstructionForABehindPullRequest }) => {
      expect(theInstructionForABehindPullRequest).toContain("pull request #9");
      expect(theInstructionForABehindPullRequest).toContain("`main`");
    });
  });

  describe("states that do not ask for a catch-up", () => {
    const it = test
      .extend("theInstructionWhenThereIsNoPullRequest", () => instructionOf(undefined))
      .extend("theInstructionWhenTheHeadIsClean", () =>
        instructionOf({
          baseRefName: "main",
          mergeStateStatus: "CLEAN",
          number: 9,
          url: "https://example.com/9",
        }),
      )
      .extend("theInstructionWhenTheHeadIsDirty", () =>
        instructionOf({
          baseRefName: "main",
          mergeStateStatus: "DIRTY",
          number: 9,
          url: "https://example.com/9",
        }),
      );

    it("says nothing when there is no pull request", ({
      theInstructionWhenThereIsNoPullRequest,
    }) => {
      expect(theInstructionWhenThereIsNoPullRequest).toBe(undefined);
    });

    it("says nothing when the head is clean", ({ theInstructionWhenTheHeadIsClean }) => {
      expect(theInstructionWhenTheHeadIsClean).toBe(undefined);
    });

    it("says nothing when the head is dirty rather than behind", ({
      theInstructionWhenTheHeadIsDirty,
    }) => {
      expect(theInstructionWhenTheHeadIsDirty).toBe(undefined);
    });
  });
});
