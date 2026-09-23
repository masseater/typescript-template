import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { loadWorkspaceDependencies } from "../../lib/dependency-catalog/workspace-manifests.ts";
import { createRequireCatalogEntry } from "./require-catalog-entry--register-shared-dependency.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({ prefix: "dont-review-it-require-catalog-entry-" });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const sharedDir = path.join(fixtureDir, "shared");
const aliasedDir = path.join(fixtureDir, "aliased");

const rootEntry = path.join(sharedDir, "entry.ts");
const alphaEntry = path.join(sharedDir, "packages/alpha/entry.ts");
const betaEntry = path.join(sharedDir, "packages/beta/entry.ts");
const gammaEntry = path.join(sharedDir, "packages/gamma/entry.ts");
const nestedGammaEntry = path.join(sharedDir, "packages/gamma/nested/deep.ts");

const packageOneEntry = path.join(aliasedDir, "packages/one/entry.ts");
const twoEntry = path.join(aliasedDir, "packages/two/entry.ts");
const looseEntry = path.join(fixtureDir, "no-manifest/loose.ts");

const CATALOG = [{ catalog: ["es-toolkit"] }];

const LEFT_PAD_SITES = "`.` at `^1.0.0`, `packages/alpha` at `^1.0.0`, `packages/beta` at `1.3.0`";

const ALIASED_TOOL_SITES = "`packages/one` at `npm:@fixture/tool`, `packages/two` at `^3.0.0`";

const ALIASED_LEFT_PAD_SITES =
  "`packages/one` at `npm:left-pad@^1.0.0`, `packages/two` at `^1.0.0`";

const OPTIONAL_SITES = "`packages/one` at `^4.0.0`, `packages/two` at `4.1.0`";

const requireCatalogEntry = createRequireCatalogEntry({
  loadWorkspaces: loadWorkspaceDependencies,
});

const FIXTURE_DIRECTORIES: readonly string[] = [
  path.join(sharedDir, "packages/alpha"),
  path.join(sharedDir, "packages/beta"),
  path.join(sharedDir, "packages/gamma"),
  path.join(aliasedDir, "packages/one"),
  path.join(aliasedDir, "packages/two"),
  path.join(aliasedDir, "sectionless"),
  path.join(aliasedDir, "manifestless"),
  path.join(fixtureDir, "no-manifest"),
  path.join(sharedDir, "packages/gamma/nested"),
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [path.join(sharedDir, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [
    path.join(sharedDir, "package.json"),
    `${JSON.stringify({ name: "root", devDependencies: { "left-pad": "^1.0.0" } }, null, 2)}\n`,
  ],
  [
    path.join(sharedDir, "packages/alpha/package.json"),
    `${JSON.stringify(
      {
        name: "alpha",
        dependencies: {
          "es-toolkit": "catalog:",
          "@fixture/utils": "workspace:*",
          linked: "link:../shared-lib",
          filed: "file:../shared-lib",
          "left-pad": "^1.0.0",
          "only-here": "^2.0.0",
        },
        peerDependencies: { "peer-only": "^1.0.0" },
      },
      null,
      2,
    )}\n`,
  ],
  [
    path.join(sharedDir, "packages/beta/package.json"),
    `${JSON.stringify(
      {
        name: "beta",
        dependencies: {
          "@fixture/utils": "workspace:*",
          linked: "link:../shared-lib",
          filed: "file:../shared-lib",
        },
        devDependencies: { "left-pad": "1.3.0" },
        peerDependencies: { "peer-only": "^1.0.0" },
      },
      null,
      2,
    )}\n`,
  ],
  [
    path.join(sharedDir, "packages/gamma/package.json"),
    `${JSON.stringify({ name: "gamma", dependencies: { "es-toolkit": "catalog:" } }, null, 2)}\n`,
  ],
  [rootEntry, MODULE_SOURCE],
  [alphaEntry, MODULE_SOURCE],
  [betaEntry, MODULE_SOURCE],
  [gammaEntry, MODULE_SOURCE],
  [nestedGammaEntry, MODULE_SOURCE],
  [path.join(aliasedDir, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(aliasedDir, "package.json"), `${JSON.stringify({ name: "aliased-root" }, null, 2)}\n`],
  [
    path.join(aliasedDir, "packages/one/package.json"),
    `${JSON.stringify(
      {
        name: "one",
        dependencies: {
          pad: "npm:left-pad@^1.0.0",
          scoped: "npm:@fixture/tool",
          broken: "npm:",
          count: 5,
        },
        optionalDependencies: { "opt-shared": "^4.0.0" },
      },
      null,
      2,
    )}\n`,
  ],
  [
    path.join(aliasedDir, "packages/two/package.json"),
    `${JSON.stringify(
      {
        name: "two",
        dependencies: { "left-pad": "^1.0.0", "@fixture/tool": "^3.0.0" },
        devDependencies: { "left-pad": "^9.9.9" },
        optionalDependencies: { "opt-shared": "4.1.0" },
      },
      null,
      2,
    )}\n`,
  ],
  [
    path.join(aliasedDir, "sectionless/package.json"),
    `${JSON.stringify({ name: "sectionless", dependencies: "oops" }, null, 2)}\n`,
  ],
  [path.join(aliasedDir, "manifestless/package.json"), "[]\n"],
  [packageOneEntry, MODULE_SOURCE],
  [twoEntry, MODULE_SOURCE],
  [path.join(fixtureDir, "no-manifest/pnpm-workspace.yaml"), "packages: []\n"],
  [looseEntry, MODULE_SOURCE],
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

describe("dont-review-it/require-catalog-entry--register-shared-dependency", () => {
  testLintRule(requireCatalogEntry, {
    valid: [
      {
        name: "without a catalog the rule holds no answer about what is registered",
        code: MODULE_SOURCE,
        filename: alphaEntry,
      },
      {
        name: "options that carry deviations but no catalog leave the rule without a catalog",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [{ deviations: [] }],
      },
      {
        name: "an empty catalog registers nothing and compares against nothing",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [{ catalog: [] }],
      },
      {
        name: "a workspace whose every dependency is registered passes",
        code: MODULE_SOURCE,
        filename: gammaEntry,
        options: CATALOG,
      },
      {
        name: "a package the catalog registers is left to the rule on catalog references",
        code: MODULE_SOURCE,
        filename: nestedGammaEntry,
        options: CATALOG,
      },
      {
        name: "a name registered as a deviation for this workspace is not asked for again",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [
          {
            catalog: ["es-toolkit"],
            deviations: [{ workspace: "packages/alpha", packages: ["left-pad"] }],
          },
        ],
      },
      {
        name: "a file no manifest governs belongs to no workspace",
        code: MODULE_SOURCE,
        filename: looseEntry,
        options: CATALOG,
      },
    ],
    invalid: [
      {
        name: "a name shared with two other workspaces is reported in the root workspace",
        documented: true,
        code: MODULE_SOURCE,
        filename: rootEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "the same name is reported again in the workspace that shares it",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "a development dependency counts as a workspace declaring the name",
        code: MODULE_SOURCE,
        filename: betaEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "a deviation registered for another workspace does not cover this one",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: [
          {
            catalog: ["es-toolkit"],
            deviations: [{ workspace: "packages/beta", packages: ["left-pad"] }],
          },
        ],
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: LEFT_PAD_SITES },
          },
        ],
      },
      {
        name: "an alias is counted under the package it resolves to",
        code: MODULE_SOURCE,
        filename: packageOneEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "@fixture/tool", sites: ALIASED_TOOL_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: ALIASED_LEFT_PAD_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "opt-shared", sites: OPTIONAL_SITES },
          },
        ],
      },
      {
        name: "the workspace on the other side of the alias carries the version it declared once",
        code: MODULE_SOURCE,
        filename: twoEntry,
        options: CATALOG,
        errors: [
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "@fixture/tool", sites: ALIASED_TOOL_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "left-pad", sites: ALIASED_LEFT_PAD_SITES },
          },
          {
            messageId: "unregisteredSharedDependency",
            data: { packageName: "opt-shared", sites: OPTIONAL_SITES },
          },
        ],
      },
    ],
  });
});
