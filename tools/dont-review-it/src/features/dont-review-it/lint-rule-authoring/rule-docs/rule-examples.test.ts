import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { lintRuleExamplesIn } from "./rule-examples.ts";

const SOURCE_PATH = "src/rules/no-thing--allow-it.ts";

const TEST_PATH = "src/rules/no-thing--allow-it.test.ts";

layer(NodeServices.layer)("lintRuleExamplesIn", (it) => {
  describe("a test that marks a case on the valid side alone", () => {
    const examplesFixture = Effect.gen(function* examples() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-examples-" });

      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, TEST_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, TEST_PATH),
        `testLintRule(rule, {
  valid: [
    { name: "a value the rule leaves alone", documented: true, code: "export const shipped = true;" },
  ],
});
`,
      );
      return yield* lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it.effect("publishes that case and finds no side to read on the other one", () =>
      Effect.gen(function* program() {
        const examples = yield* examplesFixture;
        expect(examples).toStrictEqual({
          valid: [
            {
              name: "a value the rule leaves alone",
              code: "export const shipped = true;",
              filename: null,
            },
          ],
          invalid: [],
          unspellable: [],
        });
      }),
    );
  });

  describe("a test that marks a case on the invalid side", () => {
    const examplesFixture = Effect.gen(function* examples() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-examples-" });

      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, TEST_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, TEST_PATH),
        `testLintRule(rule, {
  valid: [],
  invalid: [
    {
      name: "a value the rule rejects",
      documented: true,
      code: "export default true;",
      filename: "src/shipped.ts",
    },
  ],
});
`,
      );
      return yield* lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it.effect("publishes that case with the file name it was given", () =>
      Effect.gen(function* program() {
        const examples = yield* examplesFixture;
        expect(examples).toStrictEqual({
          valid: [],
          invalid: [
            {
              name: "a value the rule rejects",
              code: "export default true;",
              filename: "src/shipped.ts",
            },
          ],
          unspellable: [],
        });
      }),
    );
  });

  describe("a marked case that spells out no name", () => {
    const examplesFixture = Effect.gen(function* examples() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-examples-" });

      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, TEST_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, TEST_PATH),
        `testLintRule(rule, {
  valid: [{ documented: true, code: "export const shipped = true;" }],
  invalid: [],
});
`,
      );
      return yield* lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it.effect("carries it out as unspellable under a name that says so", () =>
      Effect.gen(function* program() {
        const examples = yield* examplesFixture;
        expect(examples).toStrictEqual({
          valid: [],
          invalid: [],
          unspellable: ["a case that spells out no name"],
        });
      }),
    );
  });

  describe("a test file that hands no case list to the tester", () => {
    const examplesFixture = Effect.gen(function* examples() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-examples-" });

      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, TEST_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, TEST_PATH),
        "describe(rule.name, () => {});\n",
      );
      return yield* lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it.effect("finds nothing to publish", () =>
      Effect.gen(function* program() {
        const examples = yield* examplesFixture;
        expect(examples).toStrictEqual({ valid: [], invalid: [], unspellable: [] });
      }),
    );
  });

  describe("a rule that carries no test file", () => {
    const examplesFixture = Effect.gen(function* examples() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-examples-" });

      return yield* lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it.effect("finds nothing to publish either", () =>
      Effect.gen(function* program() {
        const examples = yield* examplesFixture;
        expect(examples).toStrictEqual({ valid: [], invalid: [], unspellable: [] });
      }),
    );
  });
});
