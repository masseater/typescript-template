import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { noRuleSuppression } from "./no-rule-suppression--fix-the-violation.ts";

const SOURCE_FILE = "packages/cart/src/basket.ts";

const SPEC_FILE = "packages/cart/src/basket.test.ts";

const CONFIG_FILE = "vite.config.ts";

const GATE_RULE = "no-redundant-mock-reset--lift-mocks-into-fixture";

const PREFIXED_GATE_RULE = `dont-review-it/${GATE_RULE}`;

const SELF_RULE = "no-rule-suppression--fix-the-violation";

const OUTSIDE_RULE = "no-console";

const DECLARATION = "export const total = 1;";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({ prefix: "dont-review-it-no-rule-suppression-" });
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

describe("dont-review-it/no-rule-suppression--fix-the-violation", () => {
  testLintRule(noRuleSuppression, {
    valid: [
      {
        name: "a spec file carrying no configuration passes",
        code: DECLARATION,
        filename: SPEC_FILE,
      },
      {
        name: "options that spell out no target rule leave the gate rules in force",
        code: DECLARATION,
        filename: SPEC_FILE,
        options: [{}],
      },
      {
        name: "a configuration that declares no lint block ignores no spec file",
        code: DECLARATION,
        filename: ignoringConfig,
      },
      {
        name: "a suppression comment is left to the rule that rejects every suppression comment",
        code: `// eslint-disable-next-line ${GATE_RULE}\n${DECLARATION}`,
        filename: SPEC_FILE,
      },
      {
        name: "a configuration holding a gate rule at error passes",
        documented: true,
        code: `export default { lint: { rules: { "${PREFIXED_GATE_RULE}": "error" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a configuration holding a gate rule at error with options passes",
        code: `export default { lint: { rules: { "${GATE_RULE}": ["error", { specFileSuffixes: [".spec.ts"] }] } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a configuration turning a rule outside this gate off passes",
        documented: true,
        code: `export default { lint: { rules: { "${OUTSIDE_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rules block that pulls its entries in from elsewhere spells out no severity to read",
        code: `export default { lint: { rules: { ...sharedSeverities } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "an object carrying rules of another kind is left alone",
        code: `export const grammar = { rules: { sentence: "one" } };`,
        filename: SOURCE_FILE,
      },
      {
        name: "a configuration that keeps suppression comments powerless passes",
        code: `export default { lint: { options: { respectEslintDisableDirectives: false } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a runner configuration holding no lint block has no ignore entry to read",
        code: `export default { pack: { entry: ["src/index.ts"] } };`,
        filename: CONFIG_FILE,
      },
    ],
    invalid: [
      {
        name: "a configuration turning a gate rule off is reported",
        documented: true,
        code: `export default { lint: { rules: { "${PREFIXED_GATE_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "weakenedRule",
            data: { ruleName: PREFIXED_GATE_RULE, severity: "off" },
          },
        ],
      },
      {
        name: "a configuration lowering a gate rule to a warning is reported",
        code: `export default { lint: { rules: { "${GATE_RULE}": "warn" } } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "warn" } }],
      },
      {
        name: "a numbered severity below failing is read as the level it stands for",
        code: `export default { lint: { rules: { "${GATE_RULE}": 0 } } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "off" } }],
      },
      {
        name: "a gate rule taken down beside a spread entry is reported all the same",
        code: `export default { lint: { rules: { ...sharedSeverities, "${GATE_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "off" } }],
      },
      {
        name: "an override taking a gate rule down over a path is reported",
        code: `export default { lint: { overrides: [{ files: ["src/legacy/**"], rules: { "${GATE_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "scopedWeakenedRule",
            data: { ruleName: GATE_RULE, severity: "off", scope: "`src/legacy/**`" },
          },
        ],
      },
      {
        name: "a severity assembled elsewhere is reported",
        code: `export default { lint: { rules: { "${GATE_RULE}": chosenSeverity } } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "unreadableSeverity", data: { ruleName: GATE_RULE } }],
      },
      {
        name: "a shared configuration outside the runner config is read the same way",
        code: `export const shared = { rules: { "${GATE_RULE}": "off" } };`,
        filename: "packages/cart/lint-preset.ts",
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "off" } }],
      },
      {
        name: "a configuration that gives suppression comments back their force is reported",
        code: `export default { lint: { options: { respectEslintDisableDirectives: true } } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "respectedDisableDirectives" }],
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
      {
        name: "a rule name handed to the option joins the gate",
        code: `export default { lint: { rules: { "no-spec-clock-stub--freeze-in-fixture": "off" } } };`,
        filename: CONFIG_FILE,
        options: [{ targetRules: ["no-spec-clock-stub--freeze-in-fixture"] }],
        errors: [
          {
            messageId: "weakenedRule",
            data: { ruleName: "no-spec-clock-stub--freeze-in-fixture", severity: "off" },
          },
        ],
      },
      {
        name: "an empty option list leaves every rule of the gate in place",
        code: `export default { lint: { rules: { "${GATE_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        options: [{ targetRules: [] }],
        errors: [{ messageId: "weakenedRule", data: { ruleName: GATE_RULE, severity: "off" } }],
      },
      {
        name: "options that name no list of rules at all leave the gate carrying its own rule",
        code: `export default { lint: { rules: { "${SELF_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        options: [{}],
        errors: [{ messageId: "weakenedRule", data: { ruleName: SELF_RULE, severity: "off" } }],
      },
    ],
  });
});
