import { describe, expect, test } from "vite-plus/test";

import { instructionFor } from "./message.ts";

describe("sync-base instruction message", () => {
  describe("a pull request behind its base", () => {
    const it = test.extend("theInstructionForABehindPullRequest", () =>
      instructionFor({
        baseRefName: "main",
        number: 42,
        url: "https://example.com/pr/42",
      }));

    it("names the pull request, the base, and the way to catch up", ({
      theInstructionForABehindPullRequest,
    }) => {
      expect(theInstructionForABehindPullRequest)
        .toBe(`sync-base: pull request #42 is behind its base branch \`main\`.
The base moved ahead of this head. Bring the latest base into this branch before you continue:
- fetch the base (\`git fetch origin main\`) and rebase or merge onto it
- or run \`mergify stack sync\` when this pull request is part of a stack
Do not push while behind, and do not leave a conflicting or outdated head queued to merge.
https://example.com/pr/42`);
    });
  });
});
