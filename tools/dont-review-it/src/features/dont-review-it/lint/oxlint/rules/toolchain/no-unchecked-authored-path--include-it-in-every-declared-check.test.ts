import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { path } from "../../../../platform/path.ts";
import { noUncheckedAuthoredPath } from "./no-unchecked-authored-path--include-it-in-every-declared-check.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({
    prefix: "dont-review-it-no-unchecked-authored-path-",
  });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const ROOT_PACKAGE_MANIFEST = '{ "name": "@fixture/root" }\n';

const LEGACY_SOURCE = "module.exports = {};\n";

const GUIDE_TEXT = "read me\n";

const REACHING_SOURCE = 'import { helped } from "./helper.ts";\n\nexport const started = helped;\n';

const REACHED_SOURCE = "export const helped = true;\n";

const HELD_BY_REPOSITORY: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  covered: {},
  declared: { "docs/guide.txt": GUIDE_TEXT },
  outside: {
    "dist/bundle.js": "export const built = true;\n",
    "node_modules/vendor/index.js": LEGACY_SOURCE,
  },
  "quiet-row": {},
  undeclared: { "src/legacy.js": LEGACY_SOURCE },
  hole: { "src/legacy.js": LEGACY_SOURCE },
  broad: { "docs/guide.txt": GUIDE_TEXT },
  dead: {},
  excluded: { "types/shipped.d.ts": "export declare const shipped: boolean;\n" },
  unopened: { "config/settings.json": "{}\n" },
  receiver: {},
  "settled-scope": { "setup/entry.ts": REACHING_SOURCE, "setup/helper.ts": REACHED_SOURCE },
  "open-scope": { "setup/entry.ts": REACHING_SOURCE, "setup/helper.ts": REACHED_SOURCE },
  workspaces: {
    "packages/tool/package.json": '{ "name": "@fixture/tool" }\n',
    "packages/tool/legacy.js": LEGACY_SOURCE,
  },
};

const MANIFEST_READER = {
  name: "the package manager",
  coveredPaths: ["**/*.json", "**/*.yaml"],
};

const ANALYSER = {
  name: "the analyser",
  coveredPaths: ["**/*.ts"],
  excludedPaths: ["**/*.d.ts"],
};

const TYPE_CHECK = { name: "the type check", coveredPaths: ["**/*.ts"] };

const DECLARED_CHECKS = [MANIFEST_READER, ANALYSER];

const SPELLED_CHECKS = "`the package manager`, `the analyser`";

const coveredEntry = path.join(fixtureDir, "covered/src/app.ts");
const declaredEntry = path.join(fixtureDir, "declared/src/app.ts");
const outsideEntry = path.join(fixtureDir, "outside/src/app.ts");
const quietRowEntry = path.join(fixtureDir, "quiet-row/src/app.ts");
const undeclaredEntry = path.join(fixtureDir, "undeclared/src/app.ts");
const holeEntry = path.join(fixtureDir, "hole/src/app.ts");
const broadEntry = path.join(fixtureDir, "broad/src/app.ts");
const deadEntry = path.join(fixtureDir, "dead/src/app.ts");
const excludedEntry = path.join(fixtureDir, "excluded/src/app.ts");
const unopenedEntry = path.join(fixtureDir, "unopened/src/app.ts");
const receiverEntry = path.join(fixtureDir, "receiver/src/app.ts");
const settledScopeEntry = path.join(fixtureDir, "settled-scope/src/app.ts");
const openScopeEntry = path.join(fixtureDir, "open-scope/src/app.ts");
const rootEntry = path.join(fixtureDir, "workspaces/src/app.ts");

const toolEntry = path.join(fixtureDir, "workspaces/packages/tool/entry.ts");
const looseEntry = path.join(fixtureDir, "loose/src/app.ts");

const READ_TEXT = [{ pattern: "**/*.txt", reason: "the guide is read by people" }];

const FORBIDDEN_DECLARATION_FILES = [
  {
    name: "the forbidden files",
    consumedBy: "the analyser",
    rows: [{ pattern: "**/*.d.ts", reason: "a declaration file is generated" }],
  },
];

await Effect.gen(function* writeFixture() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  for (const [repositoryName, held] of Object.entries(HELD_BY_REPOSITORY)) {
    const repositoryDir = paths.join(fixtureDir, repositoryName);
    yield* filesystem.makeDirectory(paths.join(repositoryDir, "src"), { recursive: true });
    yield* filesystem.writeFileString(
      paths.join(repositoryDir, "pnpm-workspace.yaml"),
      WORKSPACE_MANIFEST,
    );
    yield* filesystem.writeFileString(
      paths.join(repositoryDir, "package.json"),
      ROOT_PACKAGE_MANIFEST,
    );
    for (const [heldPath, heldSource] of Object.entries(held)) {
      yield* filesystem.makeDirectory(paths.dirname(paths.join(repositoryDir, heldPath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(repositoryDir, heldPath), heldSource);
    }
    yield* filesystem.writeFileString(paths.join(repositoryDir, "src/app.ts"), MODULE_SOURCE);
  }
  yield* filesystem.writeFileString(toolEntry, MODULE_SOURCE);
  yield* filesystem.makeDirectory(paths.join(fixtureDir, "loose/src"), { recursive: true });
  yield* filesystem.writeFileString(
    paths.join(fixtureDir, "loose/pnpm-workspace.yaml"),
    "packages: []\n",
  );
  yield* filesystem.writeFileString(paths.join(fixtureDir, "loose/src/legacy.js"), LEGACY_SOURCE);
  yield* filesystem.writeFileString(looseEntry, MODULE_SOURCE);
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

describe("dont-review-it/no-unchecked-authored-path--include-it-in-every-declared-check", () => {
  testLintRule(noUncheckedAuthoredPath, {
    valid: [
      {
        name: "every authored path sits inside a check, and two checks may open the same path",
        code: MODULE_SOURCE,
        filename: coveredEntry,
        options: [{ declaredChecks: [MANIFEST_READER, ANALYSER, TYPE_CHECK] }],
      },
      {
        name: "an extension declared as read by no check is not a hole",
        code: MODULE_SOURCE,
        filename: declaredEntry,
        options: [{ declaredChecks: DECLARED_CHECKS, uncheckedDeclarations: READ_TEXT }],
      },
      {
        name: "paths outside the authored surface are not holes",
        code: MODULE_SOURCE,
        filename: outsideEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
      },
      {
        name: "a prohibition row that matches no file is the state the row asks for",
        code: MODULE_SOURCE,
        filename: quietRowEntry,
        options: [{ declaredChecks: DECLARED_CHECKS, registries: FORBIDDEN_DECLARATION_FILES }],
      },
      {
        name: "a row the check that consumes it opens is reachable",
        code: MODULE_SOURCE,
        filename: excludedEntry,
        options: [
          {
            declaredChecks: [MANIFEST_READER, ANALYSER, TYPE_CHECK],
            registries: [
              {
                name: "the forbidden files",
                consumedBy: "the type check",
                rows: [{ pattern: "**/*.d.ts", reason: "a declaration file is generated" }],
              },
            ],
          },
        ],
      },
      {
        name: "a repository that declares no check has nothing to reconcile",
        code: MODULE_SOURCE,
        filename: undeclaredEntry,
        options: [{}],
      },
      {
        name: "a hole another workspace holds is not reported here",
        code: MODULE_SOURCE,
        filename: rootEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
      },
      {
        name: "a scope registration that carries everything its files reach",
        code: MODULE_SOURCE,
        filename: settledScopeEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            scopeRegistrations: [{ name: "the bootstrap zone", registeredPaths: ["setup/**"] }],
          },
        ],
      },
      {
        name: "a directory-wide pattern is read as a registration, not as a declaration",
        code: MODULE_SOURCE,
        filename: broadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            uncheckedDeclarations: [
              { pattern: "docs/*.txt", reason: "the guide is read by people" },
            ],
          },
        ],
      },
    ],
    invalid: [
      {
        name: "an authored path no declared check opens",
        documented: true,
        code: MODULE_SOURCE,
        filename: holeEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
        errors: [
          {
            messageId: "uncheckedAuthoredPath",
            data: { authoredPath: "src/legacy.js", declaredChecks: SPELLED_CHECKS },
          },
        ],
      },
      {
        name: "a declaration of paths no check reads that covers a whole directory",
        code: MODULE_SOURCE,
        filename: broadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            uncheckedDeclarations: [{ pattern: "docs/**", reason: "the guide is read by people" }],
          },
        ],
        errors: [
          {
            messageId: "broadUncheckedDeclaration",
            data: { pattern: "docs/**", reason: "the guide is read by people" },
          },
        ],
      },
      {
        name: "an allowance row that matches no authored path",
        code: MODULE_SOURCE,
        filename: deadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            registries: [
              {
                name: "the forbidden files",
                consumedBy: "the analyser",
                allowances: [
                  { pattern: "vendor/**/*.js", reason: "the vendored bundle predates the rule" },
                ],
              },
            ],
          },
        ],
        errors: [
          {
            messageId: "deadRegistration",
            data: {
              registry: "`the forbidden files`",
              pattern: "vendor/**/*.js",
              reason: "the vendored bundle predates the rule",
            },
          },
        ],
      },
      {
        name: "a declaration of paths no check reads that matches no authored path",
        code: MODULE_SOURCE,
        filename: deadEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            uncheckedDeclarations: [{ pattern: "**/*.txt", reason: "the guide is read by people" }],
          },
        ],
        errors: [
          {
            messageId: "deadRegistration",
            data: {
              registry: "the declaration of paths no check reads",
              pattern: "**/*.txt",
              reason: "the guide is read by people",
            },
          },
        ],
      },
      {
        name: "a row aimed at paths the consuming check leaves out through an exclusion",
        code: MODULE_SOURCE,
        filename: excludedEntry,
        options: [
          {
            declaredChecks: [MANIFEST_READER, ANALYSER, TYPE_CHECK],
            registries: FORBIDDEN_DECLARATION_FILES,
          },
        ],
        errors: [
          {
            messageId: "excludedRegistration",
            data: {
              registry: "`the forbidden files`",
              pattern: "**/*.d.ts",
              check: "the analyser",
              matchedPath: "types/shipped.d.ts",
              exclusion: "`**/*.d.ts`",
            },
          },
        ],
      },
      {
        name: "a row aimed at paths the consuming check never opens",
        code: MODULE_SOURCE,
        filename: unopenedEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            registries: [
              {
                name: "the tracked paths",
                consumedBy: "the analyser",
                rows: [{ pattern: "config/*.json", reason: "settings belong to the deployment" }],
              },
            ],
          },
        ],
        errors: [
          {
            messageId: "unopenedRegistration",
            data: {
              registry: "`the tracked paths`",
              pattern: "config/*.json",
              check: "the analyser",
              matchedPath: "config/settings.json",
              coveredPaths: "`**/*.ts`",
            },
          },
        ],
      },
      {
        name: "a registry and a row that name receivers this repository does not declare",
        code: MODULE_SOURCE,
        filename: receiverEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            registries: [
              {
                name: "the required files",
                consumedBy: "the file scan",
                rows: [
                  {
                    pattern: "**/*.ts",
                    reason: "the entry is read outside the source",
                    receivers: ["the shape check"],
                  },
                ],
              },
            ],
          },
        ],
        errors: [
          {
            messageId: "undeclaredReceiver",
            data: {
              record: "Registry `the required files`",
              receiver: "the file scan",
              declaredChecks: SPELLED_CHECKS,
            },
          },
          {
            messageId: "undeclaredReceiver",
            data: {
              record: "Row `**/*.ts` of registry `the required files`",
              receiver: "the shape check",
              declaredChecks: SPELLED_CHECKS,
            },
          },
        ],
      },
      {
        name: "a registered file that reaches a file the scope registration leaves out",
        code: MODULE_SOURCE,
        filename: openScopeEntry,
        options: [
          {
            declaredChecks: DECLARED_CHECKS,
            scopeRegistrations: [
              { name: "the bootstrap zone", registeredPaths: ["setup/entry.ts"] },
            ],
          },
        ],
        errors: [
          {
            messageId: "unregisteredScopeReach",
            data: {
              scope: "the bootstrap zone",
              reachingPath: "setup/entry.ts",
              reachedPath: "setup/helper.ts",
            },
          },
        ],
      },
      {
        name: "a repository that holds no manifest keeps its findings at the root",
        code: MODULE_SOURCE,
        filename: looseEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
        errors: [
          {
            messageId: "uncheckedAuthoredPath",
            data: { authoredPath: "src/legacy.js", declaredChecks: SPELLED_CHECKS },
          },
        ],
      },
      {
        name: "a hole is reported on the workspace that owns the path",
        code: MODULE_SOURCE,
        filename: toolEntry,
        options: [{ declaredChecks: DECLARED_CHECKS }],
        errors: [
          {
            messageId: "uncheckedAuthoredPath",
            data: {
              authoredPath: "packages/tool/legacy.js",
              declaredChecks: SPELLED_CHECKS,
            },
          },
        ],
      },
    ],
  });
});
