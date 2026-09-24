import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { range } from "es-toolkit";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { noUndersizedExternalSnapshot } from "./no-undersized-external-snapshot--use-inline-snapshot.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({
    prefix: "dont-review-it-no-undersized-external-snapshot-",
  });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const SPEC_FILE_NAME = "subject.test.ts";

const RECORD_HEADER = "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html\n\n";

const SCALAR_RECORD = '"alpha"';

const RECORD_OF_THREE_LINES = `\n${range(3)
  .map((at) => `line ${String(at)}`)
  .join("\n")}\n`;

const RECORD_AT_THE_BUDGET = `\n${range(12)
  .map((at) => `line ${String(at)}`)
  .join("\n")}\n`;

const RECORD_PAST_THE_BUDGET = `\n${range(13)
  .map((at) => `line ${String(at)}`)
  .join("\n")}\n`;

const smallRecord = path.join(fixtureDir, "small-record", SPEC_FILE_NAME);

const atTheBudget = path.join(fixtureDir, "at-the-budget", SPEC_FILE_NAME);

const overTheBudget = path.join(fixtureDir, "over-the-budget", SPEC_FILE_NAME);

const shiftedByInline = path.join(fixtureDir, "shifted-by-inline", SPEC_FILE_NAME);

const shiftedByFileRecord = path.join(fixtureDir, "shifted-by-file-record", SPEC_FILE_NAME);

const hintedRecord = path.join(fixtureDir, "hinted-record", SPEC_FILE_NAME);

const thrownRecord = path.join(fixtureDir, "thrown-record", SPEC_FILE_NAME);

const tableRecords = path.join(fixtureDir, "table-records", SPEC_FILE_NAME);

const partialTableRecords = path.join(fixtureDir, "partial-table-records", SPEC_FILE_NAME);

const unrecordedKey = path.join(fixtureDir, "unrecorded-key", SPEC_FILE_NAME);

const splitTitles = path.join(fixtureDir, "split-titles", SPEC_FILE_NAME);

const hintAgainstPlainTitle = path.join(fixtureDir, "hint-against-plain-title", SPEC_FILE_NAME);

const manyCases = path.join(fixtureDir, "many-cases", SPEC_FILE_NAME);

const namedSuffixSpec = path.join(fixtureDir, "named-suffix", "subject.spec.ts");

const withoutRecordFile = path.join(fixtureDir, "no-record-file", SPEC_FILE_NAME);

const FIXTURE_DIRECTORIES: readonly string[] = [
  path.join(fixtureDir, "small-record", "__snapshots__"),
  path.join(fixtureDir, "at-the-budget", "__snapshots__"),
  path.join(fixtureDir, "over-the-budget", "__snapshots__"),
  path.join(fixtureDir, "shifted-by-inline", "__snapshots__"),
  path.join(fixtureDir, "shifted-by-file-record", "__snapshots__"),
  path.join(fixtureDir, "hinted-record", "__snapshots__"),
  path.join(fixtureDir, "thrown-record", "__snapshots__"),
  path.join(fixtureDir, "table-records", "__snapshots__"),
  path.join(fixtureDir, "partial-table-records", "__snapshots__"),
  path.join(fixtureDir, "unrecorded-key", "__snapshots__"),
  path.join(fixtureDir, "split-titles", "__snapshots__"),
  path.join(fixtureDir, "hint-against-plain-title", "__snapshots__"),
  path.join(fixtureDir, "many-cases", "__snapshots__"),
  path.join(fixtureDir, "named-suffix", "__snapshots__"),
  path.join(fixtureDir, "no-record-file"),
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [
    path.join(fixtureDir, "small-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_OF_THREE_LINES}\`;\n`,
  ],
  [
    path.join(fixtureDir, "at-the-budget", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_AT_THE_BUDGET}\`;\n`,
  ],
  [
    path.join(fixtureDir, "over-the-budget", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n`,
  ],
  [
    path.join(fixtureDir, "shifted-by-inline", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n\nexports[\`outer > names a behaviour 2\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "shifted-by-file-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n\nexports[\`outer > names a behaviour 2\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "hinted-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_PAST_THE_BUDGET}\`;\n\nexports[\`outer > names a behaviour > the hint 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "thrown-record", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "table-records", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > scalar 1 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 2 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "partial-table-records", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > scalar 1 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "unrecorded-key", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > some other behaviour 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "split-titles", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer names > a behaviour 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "hint-against-plain-title", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > names a behaviour > the hint 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > names a behaviour the hint 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "many-cases", "__snapshots__", `${SPEC_FILE_NAME}.snap`),
    `${RECORD_HEADER}exports[\`outer > scalar 1 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 2 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 3 1\`] = \`${SCALAR_RECORD}\`;\n\nexports[\`outer > scalar 4 1\`] = \`${SCALAR_RECORD}\`;\n`,
  ],
  [
    path.join(fixtureDir, "named-suffix", "__snapshots__", "subject.spec.ts.snap"),
    `${RECORD_HEADER}exports[\`outer > names a behaviour 1\`] = \`${RECORD_OF_THREE_LINES}\`;\n`,
  ],
];

await Effect.gen(function* writeFixture() {
  const filesystem = yield* FileSystem.FileSystem;
  for (const directory of FIXTURE_DIRECTORIES) {
    yield* filesystem.makeDirectory(directory, { recursive: true });
  }
  for (const [filePath, content] of FIXTURE_FILES) {
    yield* filesystem.writeFileString(filePath, content);
  }
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

describe("dont-review-it/no-undersized-external-snapshot--use-inline-snapshot", () => {
  testLintRule(noUndersizedExternalSnapshot, {
    valid: [
      {
        name: "a file that is not a spec is left alone",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: path.join(fixtureDir, "small-record", "subject.ts"),
      },
      {
        name: "a spec with no record file has nothing to measure",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: withoutRecordFile,
      },
      {
        name: "a key the record file does not carry has nothing to measure",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: unrecordedKey,
      },
      {
        name: "a record past the budget is already in the right place",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: overTheBudget,
      },
      {
        name: "an inline record is the other rule's subject",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchInlineSnapshot(`"alpha"`);\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "a file record is the counter's business and not this rule's",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchFileSnapshot("./subject.txt");\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "a snapshot outside every test block resolves to no key",
        code: "expect(subject).toMatchSnapshot();",
        filename: smallRecord,
      },
      {
        name: "a table whose cases are not all recorded yet has nothing to measure",
        code: 'describe("outer", () => {\n  it.each([1, 2])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: partialTableRecords,
      },
      {
        name: "a table written as a tagged template cannot be spelled out here and is left alone",
        code: 'describe("outer", () => {\n  it.each`a`("scalar $a", ({ a }) => {\n    expect(a).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "raising the budget past the record leaves it in place",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\nexpect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        options: [{ maxLines: 2 }],
      },
      {
        name: "a snapshot matcher reached on a receiver that is no assertion is another API",
        code: "held.toMatchSnapshot();",
        filename: smallRecord,
      },
      {
        name: "a table declaration built by a bare call keeps the title it was written with",
        code: 'each([1])("scalar %s", (value) => {\n  expect(value).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a member other than a table member keeps the title it was written with",
        code: 'it.notEach([1])("scalar %s", (value) => {\n  expect(value).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a table member handed no table keeps the title it was written with",
        code: 'it.each()("scalar %s", (value) => {\n  expect(value).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a tagged table whose tag is a bare name is read as a plain title",
        code: 'each`a`("scalar", () => {\n  expect(subject).toMatchSnapshot();\n});',
        filename: smallRecord,
      },
      {
        name: "a block whose first argument is spread declares no title of its own",
        code: 'describe(...rest, () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
      },
      {
        name: "a block whose last argument is no function declares no title of its own",
        code: 'describe("outer", it("names a behaviour", () => {\n  expect(subject).toMatchSnapshot();\n}));',
        filename: smallRecord,
      },
      {
        name: "a call standing where the title of a block goes keeps its place among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", expect(subject).toMatchSnapshot(), () => {});\n});',
        filename: withoutRecordFile,
      },
      {
        name: "a table declaring no case records nothing to measure",
        code: 'describe("outer", () => {\n  it.each([])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
      },
    ],
    invalid: [
      {
        name: "property matchers are no hint, and the repair leaves the call for a human to finish",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot({ id: expect.any(String) });\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: null,
      },
      {
        name: "a property matcher beside a hint is reported without a repair as well",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot({ createdAt: expect.any(Date) }, "the hint");\n  });\n});',
        filename: hintedRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output: null,
      },
      {
        name: "naming the spec suffix leaves the shared budget where it was",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: namedSuffixSpec,
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a spread hint cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot(...hints);\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "options that spell out no budget leave the shared budget in force",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        options: [{}],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a record inside the budget is reported and moved to an inline record",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a record at the budget stays on the inline side of the boundary",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: atTheBudget,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "an inline record ahead of it shifts which entry the call is measured against",
        documented: true,
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchInlineSnapshot(`"first"`);\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: shiftedByInline,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchInlineSnapshot(`"first"`);\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a file record ahead of it shifts which entry the call is measured against",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchFileSnapshot("./first.txt");\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: shiftedByFileRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(first).toMatchFileSnapshot("./first.txt");\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a hint puts the call in its own run of entries and the repair drops it",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot("the hint");\n  });\n});',
        filename: hintedRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a thrown error record moves to the inline spelling of the same matcher",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(run).toThrowErrorMatchingSnapshot();\n  });\n});',
        filename: thrownRecord,
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(run).toThrowErrorMatchingInlineSnapshot();\n  });\n});',
      },
      {
        name: "a written out table is measured case by case and asks for a split",
        code: 'describe("outer", () => {\n  it.each([1, 2])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: tableRecords,
        errors: [{ messageId: "undersizedTableDrivenSnapshot" }],
      },
      {
        name: "a table built at run time cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it.each(rows)("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a title built at run time cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it(`names ${behaviour}`, () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a hint built at run time cannot be measured and is reported as such",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot(chosenHint);\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a loop has no settled position among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    for (const value of rows) {\n      expect(value).toMatchSnapshot();\n    }\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a branch has no settled position among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    if (ready) {\n      expect(subject).toMatchSnapshot();\n    }\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call inside a nested callback has no settled position among the entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    rows.forEach((value) => {\n      expect(value).toMatchSnapshot();\n    });\n  });\n});',
        filename: smallRecord,
        errors: [{ messageId: "unresolvableExternalSnapshot" }],
      },
      {
        name: "a call after one that lost its position loses its own position too",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    for (const value of rows) {\n      expect(value).toMatchSnapshot();\n    }\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: smallRecord,
        errors: [
          { messageId: "unresolvableExternalSnapshot" },
          { messageId: "unresolvableExternalSnapshot" },
        ],
      },
      {
        name: "two title splits that read alike keep separate runs of entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});\ndescribe("outer names", () => {\n  it("a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: splitTitles,
        errors: [
          { messageId: "undersizedExternalSnapshot" },
          { messageId: "undersizedExternalSnapshot" },
        ],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});\ndescribe("outer names", () => {\n  it("a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a hinted call and a title that reads alike keep separate runs of entries",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot("the hint");\n  });\n  it("names a behaviour the hint", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: hintAgainstPlainTitle,
        errors: [
          { messageId: "undersizedExternalSnapshot" },
          { messageId: "undersizedExternalSnapshot" },
        ],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n  it("names a behaviour the hint", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
      {
        name: "a table with more cases than the report lists counts the ones it leaves out",
        code: 'describe("outer", () => {\n  it.each([1, 2, 3, 4])("scalar %s", (value) => {\n    expect(value).toMatchSnapshot();\n  });\n});',
        filename: manyCases,
        errors: [{ messageId: "undersizedTableDrivenSnapshot" }],
      },
      {
        name: "lowering the budget is not a way to leave a record outside",
        code: 'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchSnapshot();\n  });\n});',
        filename: overTheBudget,
        options: [{ maxLines: 13 }],
        errors: [{ messageId: "undersizedExternalSnapshot" }],
        output:
          'describe("outer", () => {\n  it("names a behaviour", () => {\n    expect(subject).toMatchInlineSnapshot();\n  });\n});',
      },
    ],
  });
});
