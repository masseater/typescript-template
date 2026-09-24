import { createDontReviewItRule } from "../../../../create-rule.ts";
import { repeatedBodyVisitor } from "../../lib/duplicated-bodies/site-report.ts";
import { isOutOfScopeSource } from "../../lib/out-of-scope-source.ts";

import type { WorkspaceLintRule } from "../../../../lint-rule-authoring/index.ts";
import type { BodyIndexLoader } from "../../lib/duplicated-bodies/body-index.ts";

export const createNoDuplicatedBody = ({
  loadIndex,
}: {
  readonly loadIndex: BodyIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-duplicated-body--import-the-existing-declaration",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow a declaration whose body is spelled exactly as another declaration elsewhere in the repository, so one behaviour keeps one owner instead of drifting between copies",
        relatedGuidelines: [".claude/skills/reviews/references/ownership-and-duplication.md"],
      },
      messages: {
        duplicatedBody:
          "A declaration must not repeat a body that already exists elsewhere in this repository. The same body is declared at {{sites}}. Decide which module owns the behaviour, export it from there, and import it everywhere else.",
      },
      schema: [],
    },
    create(inspection) {
      if (isOutOfScopeSource(inspection.filename)) return {};

      return repeatedBodyVisitor({
        inspection,
        loadIndex,
        messageId: "duplicatedBody",
        sitesOf: (index, writtenBody) =>
          index.sitesByFingerprint.get(writtenBody.fingerprint) ?? [],
      });
    },
  });
