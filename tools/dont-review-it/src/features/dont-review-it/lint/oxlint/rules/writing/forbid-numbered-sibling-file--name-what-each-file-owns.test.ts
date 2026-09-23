import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { path } from "../../../../platform/path.ts";
import { forbidNumberedSiblingFile } from "./forbid-numbered-sibling-file--name-what-each-file-owns.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({
    prefix: "dont-review-it-forbid-numbered-sibling-file-",
  });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const SOURCE_CONTENT = "export const total = 1;\n";

const FIXTURE_DIRECTORIES: readonly string[] = [
  path.join(fixtureDir, "ordinal"),
  path.join(fixtureDir, "suffix-chain"),
  path.join(fixtureDir, "bare"),
  path.join(fixtureDir, "underscore"),
  path.join(fixtureDir, "word-digit"),
  path.join(fixtureDir, "lonely"),
  path.join(fixtureDir, "letter"),
  path.join(fixtureDir, "own-test"),
  path.join(fixtureDir, "different-prefix"),
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [path.join(fixtureDir, "ordinal/order-1.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "ordinal/order-2.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "suffix-chain/parser-1.test.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "suffix-chain/parser-2.test.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "bare/handler.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "bare/handler-1.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "underscore/step_1.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "underscore/step_2.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "word-digit/oauth.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "word-digit/oauth2.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "word-digit/base64.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "lonely/report-1.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "letter/grid-x.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "letter/grid-y.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "own-test/widget-1.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "own-test/widget-1.test.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "different-prefix/alpha-1.ts"), SOURCE_CONTENT],
  [path.join(fixtureDir, "different-prefix/beta-2.ts"), SOURCE_CONTENT],
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

describe("dont-review-it/forbid-numbered-sibling-file--name-what-each-file-owns", () => {
  testLintRule(forbidNumberedSiblingFile, {
    valid: [
      {
        name: "digits attached to a word without a separator carry meaning of their own",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "word-digit/oauth2.ts"),
      },
      {
        name: "a name that is a word ending in digits is not a split even with no sibling",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "word-digit/base64.ts"),
      },
      {
        name: "a numbered name with no sibling to pair with is not a split",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "lonely/report-1.ts"),
      },
      {
        name: "a single letter after the separator can name an axis, so it is left to review",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "letter/grid-x.ts"),
      },
      {
        name: "the test file of a numbered source shares its base name and is not a sibling split",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "own-test/widget-1.ts"),
      },
      {
        name: "numbered names that do not share a prefix are unrelated files",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "different-prefix/alpha-1.ts"),
      },
    ],
    invalid: [
      {
        name: "two files that differ only by an ordinal are one responsibility in two places",
        documented: true,
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "ordinal/order-1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "order-2.ts" } }],
      },
      {
        name: "the other half of the same split is reported on its own, from the remembered listing",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "ordinal/order-2.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "order-1.ts" } }],
      },
      {
        name: "the ordinal is found before the suffix chain, so numbered test files are caught",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "suffix-chain/parser-1.test.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "parser-2.test.ts" } }],
      },
      {
        name: "a numbered file that sits beside the unnumbered name it was split off from",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "bare/handler-1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "handler.ts" } }],
      },
      {
        name: "an underscore separates the ordinal just as a hyphen does",
        code: "export const total = 1;",
        filename: path.join(fixtureDir, "underscore/step_1.ts"),
        errors: [{ messageId: "numberedSiblingFile", data: { sibling: "step_2.ts" } }],
      },
    ],
  });
});
