import { createDontReviewItRule } from "../../../../create-rule.ts";
import { environmentKeyVisitor } from "../../lib/environment-keys.ts";
import { optionsRecord } from "../../lib/rule-options.ts";

import type { Options } from "@oxlint/plugins";

const entryFilesFrom = (ruleOptions: Readonly<Options>): readonly string[] => {
  const entryFiles = optionsRecord(ruleOptions)?.entryFiles;
  if (!Array.isArray(entryFiles)) return [];
  return entryFiles.filter((candidate): candidate is string => typeof candidate === "string");
};

const isEntryFile = (filename: string, entryFiles: readonly string[]): boolean => {
  const posixFilename = filename.replaceAll("\\", "/");
  return entryFiles.some(
    (entryFile) => posixFilename === entryFile || posixFilename.endsWith(`/${entryFile}`),
  );
};

export const noEnvironmentReadBelowEntry = createDontReviewItRule({
  name: "no-environment-read-below-entry--read-the-validated-configuration",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading a key of `process.env`, `import.meta.env` or a Worker's `env` outside the entry files that validate the environment with a schema, so every setting reaches the code below them already checked and typed",
      relatedGuidelines: [".claude/skills/reviews/references/io-boundaries-and-types.md"],
    },
    messages: {
      environmentRead:
        "A key of the process environment or of a Worker's `env` must not be read here. Declare the key in the schema of the entry file that validates the environment, and take the validated value from what that entry hands down.",
    },
    schema: [
      {
        type: "object",
        properties: {
          entryFiles: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (isEntryFile(inspection.filename, entryFilesFrom(inspection.options))) return {};
    return environmentKeyVisitor((occurrence) => {
      if (occurrence.place !== "read") return;
      inspection.report({ node: occurrence.node, messageId: "environmentRead" });
    });
  },
});
