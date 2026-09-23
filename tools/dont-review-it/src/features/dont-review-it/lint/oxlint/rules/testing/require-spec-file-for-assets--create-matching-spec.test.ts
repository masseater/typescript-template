import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { requireSpecFileForAssets } from "./require-spec-file-for-assets--create-matching-spec.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({
    prefix: "dont-review-it-require-spec-file-for-assets-",
  });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const ASSETS_SOURCE = "export const orderTotals = [1, 2];\n";

const SPEC_SOURCE = "export const covered = true;\n";

const ORDER_OWNER_NAMES = "`order.test.ts` or `order.test.tsx`";

const FIXTURE_DIRECTORIES: readonly string[] = [
  path.join(fixtureDir, "owned"),
  path.join(fixtureDir, "owned-tsx"),
  path.join(fixtureDir, "empty-owner"),
  path.join(fixtureDir, "plain"),
  path.join(fixtureDir, "bare"),
  path.join(fixtureDir, "spec-of-assets"),
  path.join(fixtureDir, "orphan"),
  path.join(fixtureDir, "elsewhere/nested"),
  path.join(fixtureDir, "reader"),
  path.join(fixtureDir, "unparsed"),
  path.join(fixtureDir, "configured"),
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [path.join(fixtureDir, "owned/order.assets.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "owned/order.test.ts"), SPEC_SOURCE],
  [path.join(fixtureDir, "owned-tsx/widget.assets.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "owned-tsx/widget.test.tsx"), SPEC_SOURCE],
  [path.join(fixtureDir, "empty-owner/report.assets.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "empty-owner/report.test.ts"), ""],
  [path.join(fixtureDir, "plain/order.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "bare/assets.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "spec-of-assets/order.assets.test.ts"), SPEC_SOURCE],
  [path.join(fixtureDir, "orphan/order.assets.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "elsewhere/order.assets.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "elsewhere/nested/order.test.ts"), SPEC_SOURCE],
  [path.join(fixtureDir, "reader/order.assets.ts"), ASSETS_SOURCE],
  [path.join(fixtureDir, "reader/catalog.test.ts"), SPEC_SOURCE],
  [path.join(fixtureDir, "unparsed/order.assets.json"), "[1, 2]\n"],
  [path.join(fixtureDir, "configured/order.samples.ts"), ASSETS_SOURCE],
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

describe("dont-review-it/require-spec-file-for-assets--create-matching-spec", () => {
  testLintRule(requireSpecFileForAssets, {
    valid: [
      {
        name: "test data owned by the spec of the same stem beside it",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "owned/order.assets.ts"),
      },
      {
        name: "any spelling the repository recognises for a spec can carry the ownership",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "owned-tsx/widget.assets.ts"),
      },
      {
        name: "an owner that holds no test still owns the data, and is left to the rule on specs",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "empty-owner/report.assets.ts"),
      },
      {
        name: "a module that carries no test data marker needs no owner",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "plain/order.ts"),
      },
      {
        name: "a module named after the marker alone names no stem to own it",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "bare/assets.ts"),
      },
      {
        name: "the marker is read in front of the extension, so a spec of test data stays a spec",
        code: SPEC_SOURCE,
        filename: path.join(fixtureDir, "spec-of-assets/order.assets.test.ts"),
      },
      {
        name: "a marker the repository does not spell leaves the file outside the rule",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "configured/order.samples.ts"),
      },
    ],
    invalid: [
      {
        name: "test data with no spec of its stem anywhere",
        documented: true,
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "orphan/order.assets.ts"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "a spec of the same stem in another directory does not own this data",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "elsewhere/order.assets.ts"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "a spec of another stem beside the data reads it without owning it",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "reader/order.assets.ts"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "the extension behind the marker does not release the data from having an owner",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "unparsed/order.assets.json"),
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "the marker a repository configures decides which files need an owner",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "configured/order.samples.ts"),
        options: [{ assetsNameMarkers: ["samples"] }],
        errors: [{ messageId: "unownedAssets", data: { ownerNames: ORDER_OWNER_NAMES } }],
      },
      {
        name: "the spec spelling a repository configures decides which owner is looked for",
        code: ASSETS_SOURCE,
        filename: path.join(fixtureDir, "owned/order.assets.ts"),
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "unownedAssets", data: { ownerNames: "`order.spec.ts`" } }],
      },
    ],
  });
});
