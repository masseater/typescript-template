import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { isAssertionEntryCall } from "../../lib/spec-syntax/assertion-entries.ts";
import { isDataImportReference } from "../../lib/spec-syntax/data-imports.ts";
import {
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
} from "../../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import { unwrapSubject } from "../../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  testBlockRootNames,
  testCallbacksOf,
} from "../../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";
import type { ScopeLookup } from "../../lib/resolved-bindings.ts";

const handsOverDataImport = (subject: ESTree.Expression, scopeAt: ScopeLookup): boolean => {
  const written = unwrapSubject(subject);
  return written.type === "Identifier" && isDataImportReference(written, scopeAt);
};

const dataFixtureNamesIn = (
  calls: readonly ESTree.CallExpression[],
  scopeAt: ScopeLookup,
): ReadonlySet<string> =>
  new Set(
    calls
      .flatMap((call) => fixtureDeclarationsOf(call))
      .filter(({ subjects }) => subjects.some((subject) => handsOverDataImport(subject, scopeAt)))
      .map(({ name }) => name),
  );

const enclosingTestBlockOf = (
  node: ESTree.Node,
  rootNames: ReadonlySet<string>,
): ESTree.CallExpression | null => {
  const { parent } = node;
  if (parent === null) return null;
  if (parent.type === "CallExpression" && declaresTestBlock(parent, rootNames)) return parent;
  return enclosingTestBlockOf(parent, rootNames);
};

const fixtureBoundTo = (
  reference: ESTree.IdentifierReference,
  rootNames: ReadonlySet<string>,
): string | null => {
  const block = enclosingTestBlockOf(reference, rootNames);
  if (block === null) return null;
  return (
    testCallbacksOf(block)
      .flatMap((testCallback) => fixtureDependenciesOf(testCallback) ?? [])
      .find(({ boundAs }) => boundAs === reference.name)?.name ?? null
  );
};

type WholeDataSubject = {
  readonly node: ESTree.IdentifierReference;
  readonly messageId: string;
  readonly fixture: string;
};

const wholeDataSubjectOf = (given: {
  readonly assertionEntry: ESTree.CallExpression;
  readonly rootNames: ReadonlySet<string>;
  readonly dataFixtures: ReadonlySet<string>;
  readonly scopeAt: ScopeLookup;
}): WholeDataSubject | null => {
  const [handed] = given.assertionEntry.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;

  const subject = unwrapSubject(handed);
  if (subject.type !== "Identifier") return null;
  if (isDataImportReference(subject, given.scopeAt)) {
    return { node: subject, messageId: "wholeDataImport", fixture: subject.name };
  }

  const fixture = fixtureBoundTo(subject, given.rootNames);
  if (fixture === null || !given.dataFixtures.has(fixture)) return null;
  return { node: subject, messageId: "wholeDataFixture", fixture };
};

export const noWholeDataImportSubject = createDontReviewItRule({
  name: "no-whole-data-import-subject--assert-the-contract-member",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow handing an assertion a whole imported data file, so a spec states the part of that file it keeps rather than restating the file and failing on every unrelated edit",
      relatedGuidelines: [
        ".claude/skills/reviews/references/assert-observable-behavior-with-real-dependencies.md",
      ],
    },
    messages: {
      wholeDataImport:
        "The subject of an assertion must not be a whole imported data file. Pass the member of `{{subject}}` that states the contract, such as `{{subject}}.exports`, to the assertion.",
      wholeDataFixture:
        "The subject of an assertion must not be a fixture that hands over a whole imported data file. Narrow the fixture `{{fixture}}` to the member that states the contract, and name the fixture after that member.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    return {
      "Program:exit"(program: ESTree.Program) {
        const scopeAt: ScopeLookup = (node) => inspection.sourceCode.getScope(node);
        const rootNames = testBlockRootNames(program);
        const calls = nodesOfType(program, "CallExpression");
        const dataFixtures = dataFixtureNamesIn(calls, scopeAt);

        for (const assertionEntry of calls.filter((call) => isAssertionEntryCall(call))) {
          const whole = wholeDataSubjectOf({ assertionEntry, rootNames, dataFixtures, scopeAt });
          if (whole === null) continue;
          inspection.report({
            node: whole.node,
            messageId: whole.messageId,
            data: { subject: whole.node.name, fixture: whole.fixture },
          });
        }
      },
    };
  },
});
