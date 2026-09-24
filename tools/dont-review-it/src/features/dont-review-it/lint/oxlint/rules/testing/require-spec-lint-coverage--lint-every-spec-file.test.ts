import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { requireSpecLintCoverage } from "./require-spec-lint-coverage--lint-every-spec-file.ts";

const SOURCE_FILE = "packages/cart/src/basket.ts";

const SPEC_FILE = "packages/cart/src/basket.test.ts";

const GUARDED_ELSEWHERE_FILE = "packages/cart/specs/basket.spec.ts";

const MISPLACED_SPECIFICATION_FILE = "packages/cart/src/basket.spec.ts";

const CONFIG_FILE = "vite.config.ts";

const BUNDLE_RULE = "dont-review-it/require-test-block-spelling--use-configured-fn";

const SPELLED_SUFFIXES = "`.test.ts`, `.test.tsx`";

const DECLARATION = "export const total = 1;";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({
    prefix: "dont-review-it-require-spec-lint-coverage-",
  });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);
const ignoringConfig = path.join(fixtureDir, CONFIG_FILE);

const FIXTURE_DIRECTORIES: readonly string[] = [path.join(fixtureDir, "src/legacy")];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [path.join(fixtureDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n"],
  [path.join(fixtureDir, "package.json"), '{ "name": "@fixture/root" }\n'],
  [path.join(fixtureDir, "src/legacy/basket.test.ts"), 'it("counts", () => {});\n'],
  [ignoringConfig, DECLARATION],
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

describe("dont-review-it/require-spec-lint-coverage--lint-every-spec-file", () => {
  testLintRule(requireSpecLintCoverage, {
    valid: [
      {
        name: "a source file that declares no test block stands outside this bundle",
        code: DECLARATION,
        filename: SOURCE_FILE,
      },
      {
        name: "a source file that binds `it` to a helper of its own declares no test block",
        code: `const it = (title: string, run: () => void): void => { run(); };\nit("counts", () => { console.log(title); });`,
        filename: SOURCE_FILE,
      },
      {
        name: "a source file that names `it` on a member declares no test block",
        code: `const helpers = { it: 1 };\nexport const held = helpers.it;`,
        filename: SOURCE_FILE,
      },
      {
        name: "a spec file that declares a test block sits inside the reach of this bundle",
        documented: true,
        code: `it("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SPEC_FILE,
      },
      {
        name: "a spec file that declares its blocks through a renamed import sits inside that reach too",
        code: `import { it as scenario } from "vitest";\nscenario("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SPEC_FILE,
      },
      {
        name: "a spec file that holds no test block yet is a spec somebody started",
        code: DECLARATION,
        filename: SPEC_FILE,
      },
      {
        name: "a spec file that takes the test vocabulary from an import keeps its name",
        code: `import { expect } from "vitest";\nexport const held = expect;`,
        filename: SPEC_FILE,
      },
      {
        name: "a bundle rule held at the level that fails a run passes",
        documented: true,
        code: `export default { lint: { rules: { "${BUNDLE_RULE}": "error" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rule outside this bundle may sit at any level",
        code: `export default { lint: { rules: { "dont-review-it/no-array-mutation--derive-new-array": "off" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a setting only one rule reads stays with that rule",
        code: `export default { lint: { rules: { "dont-review-it/forbid-oversized-file--split-by-responsibility": ["error", { maxLines: 400 }] } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a file that is not the lint configuration is read for its declarations alone",
        code: `export default { lint: { rules: { "${BUNDLE_RULE}": "off" } } };`,
        filename: "rules-snapshot.ts",
      },
      {
        name: "a rules entry whose key is computed names no rule this repository holds",
        code: `const held = "x";\nexport default { lint: { rules: { [held]: "off" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rules block assembled by spread carries no entry to read",
        code: `const shared = {};\nexport default { lint: { rules: { ...shared } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a severity written as a single-element array carries no options",
        code: `export default { lint: { rules: { "${BUNDLE_RULE}": ["error"] } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "options assembled by spread carry no setting to read",
        code: `const shared = {};\nexport default { lint: { rules: { "${BUNDLE_RULE}": ["error", { ...shared }] } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a configuration that holds no lint block holds nothing to read",
        code: `export default { test: { coverage: {} } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a declaration that binds names by destructuring binds no test vocabulary",
        code: `const { held } = { held: 1 };\nexport const value = held;`,
        filename: SPEC_FILE,
      },
      {
        name: "a source file that declares a function of its own keeps its name",
        code: `function held(): number { return 1; }\nexport const value = held();`,
        filename: SOURCE_FILE,
      },
      {
        name: "a specification test in the specs directory is guarded by the bundle that owns it",
        code: `it("counts the basket", () => { expect(1).toBe(1); });`,
        filename: GUARDED_ELSEWHERE_FILE,
      },
    ],
    invalid: [
      {
        name: "the specification file name outside the specs directory reaches no bundle",
        code: `it("counts the basket", () => { expect(1).toBe(1); });`,
        filename: MISPLACED_SPECIFICATION_FILE,
        errors: [
          {
            messageId: "uncoveredSpecFile",
            data: { blockName: "it", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a source file that declares a test block sits outside the reach of this bundle",
        documented: true,
        code: `it("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "uncoveredSpecFile",
            data: { blockName: "it", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "the other injected spelling of a test block is read the same way",
        code: `test("counts the basket", () => { expect(1).toBe(1); });`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "uncoveredSpecFile",
            data: { blockName: "test", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a modifier in front of the block does not take the declaration out of reach",
        code: `it.each([1, 2])("counts %s", (held: number) => { expect(held).toBe(held); });`,
        filename: SOURCE_FILE,
        errors: [
          {
            messageId: "uncoveredSpecFile",
            data: { blockName: "it", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a spec-named file that binds `expect` to something else is swept into this bundle",
        code: `const expect = (held: number): number => held;\nexport const doubled = expect(2);`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "unrelatedFileInScope",
            data: { boundName: "expect", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a spec-named file that declares a function named `test` is swept into this bundle",
        code: `function test(held: number): number { return held; }\nexport const doubled = test(2);`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "unrelatedFileInScope",
            data: { boundName: "test", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a spec-named file that declares a class named `expect` is swept into this bundle",
        code: `class expect { held = 1; }\nexport const held = expect;`,
        filename: SPEC_FILE,
        errors: [
          {
            messageId: "unrelatedFileInScope",
            data: { boundName: "expect", specSuffixes: SPELLED_SUFFIXES },
          },
        ],
      },
      {
        name: "a bundle rule taken down to a level that passes a run is reported",
        documented: true,
        code: `export default { lint: { rules: { "${BUNDLE_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "disabledBundleRule",
            data: { ruleName: BUNDLE_RULE, severity: "off" },
          },
        ],
      },
      {
        name: "an override that takes a bundle rule down over part of the tree is reported",
        code: `const carried = "apps/**";\nexport default { lint: { overrides: [{ files: [carried, "apps/site/**"], rules: { "${BUNDLE_RULE}": "warn" } }] } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "scopedDisabledBundleRule",
            data: { ruleName: BUNDLE_RULE, severity: "warn", scope: "`apps/site/**`" },
          },
        ],
      },
      {
        name: "an override whose paths are written outside the entry names no scope",
        code: `const paths = ["apps/site/**"];\nexport default { lint: { overrides: [{ files: paths, rules: { "${BUNDLE_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "disabledBundleRule",
            data: { ruleName: BUNDLE_RULE, severity: "off" },
          },
        ],
      },
      {
        name: "a setting more than one rule reads must not sit in a single rule entry",
        code: `export default { lint: { rules: { "${BUNDLE_RULE}": ["error", { specFileSuffixes: [".spec.ts"] }] } } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "settingWrittenPerRule",
            data: { settingKey: "specFileSuffixes", ruleName: BUNDLE_RULE },
          },
        ],
      },
      {
        name: "an ignore entry that covers an authored spec file is reported",
        code: `export default { lint: { ignorePatterns: ["**/legacy/**", "docs/**"] } };`,
        filename: ignoringConfig,
        errors: [
          {
            messageId: "ignoredSpecFile",
            data: { pattern: "**/legacy/**", matchedPath: "src/legacy/basket.test.ts" },
          },
        ],
      },
    ],
  });
});
