import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  namedFingerprintOf,
  type BodyIndexLoader,
} from "../../lib/duplicated-bodies/body-index.ts";
import { repeatedBodyVisitor } from "../../lib/duplicated-bodies/site-report.ts";
import { isOutOfScopeSource } from "../../lib/out-of-scope-source.ts";

import type { WorkspaceLintRule } from "../../../../lint-rule-authoring/index.ts";

export const createNoTwinDeclaration = ({
  loadIndex,
}: {
  readonly loadIndex: BodyIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-twin-declaration--merge-into-one-owner",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow a declaration that another declaration in the repository spells with the same name and the same body, so one concept keeps one owner however small the body is",
        relatedGuidelines: [".claude/skills/reviews/references/ownership-and-duplication.md"],
      },
      messages: {
        twinDeclaration:
          "A declaration must not carry both the name and the body of another declaration in this repository. The same declaration stands at {{sites}}. Decide which module owns the concept, export it from there, and import it everywhere else.",
      },
      schema: [],
    },
    create(inspection) {
      if (isOutOfScopeSource(inspection.filename)) return {};

      return repeatedBodyVisitor({
        inspection,
        loadIndex,
        messageId: "twinDeclaration",
        sitesOf: (index, writtenBody) =>
          index.sitesByNamedFingerprint.get(namedFingerprintOf(writtenBody)) ?? [],
      });
    },
  });
