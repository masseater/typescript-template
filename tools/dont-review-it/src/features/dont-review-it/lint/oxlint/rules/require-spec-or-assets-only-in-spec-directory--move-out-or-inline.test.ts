import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../lint-rule-authoring/index.ts";
import { path } from "../../../platform/path.ts";
import { requireSpecOrAssetsOnlyInSpecDirectory } from "./require-spec-or-assets-only-in-spec-directory--move-out-or-inline.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({
    prefix: "dont-review-it-require-spec-or-assets-only-in-spec-directory-",
  });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const MODULE_SOURCE = "export const held = true;\n";

const SPEC_NAMES = "`*.test.ts`, `*.test.tsx`";

const ASSETS_NAMES = "`*.assets.*`";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const ROOT_PACKAGE_MANIFEST = '{ "name": "fixture" }\n';
const heldSource = path.join(fixtureDir, "held/packages/alpha/src/order.ts");
const carvedSource = path.join(fixtureDir, "carved/packages/alpha/src/order.ts");
const untouchedSource = path.join(fixtureDir, "carved/packages/beta/src/price.ts");
const nestedSource = path.join(fixtureDir, "nested/src/entry.ts");
const stemlessSource = path.join(fixtureDir, "stemless/src/entry.ts");
const renamedSource = path.join(fixtureDir, "renamed/src/entry.ts");
const generatedSource = path.join(fixtureDir, "generated/src/entry.ts");

const RENAMED_CONVENTION = [
  {
    specDirectoryNames: ["cases"],
    specFileSuffixes: [".spec.ts"],
    assetsNameMarkers: ["data"],
  },
];

const FIXTURE_DIRECTORIES: readonly string[] = [
  path.join(fixtureDir, "held/packages/alpha/test"),
  path.join(fixtureDir, "held/packages/alpha/src"),
  path.join(fixtureDir, "carved/packages/alpha/test"),
  path.join(fixtureDir, "carved/packages/alpha/src"),
  path.join(fixtureDir, "carved/packages/beta/src"),
  path.join(fixtureDir, "nested/test/orders"),
  path.join(fixtureDir, "nested/src"),
  path.join(fixtureDir, "stemless/test"),
  path.join(fixtureDir, "stemless/src"),
  path.join(fixtureDir, "renamed/cases"),
  path.join(fixtureDir, "renamed/src"),
  path.join(fixtureDir, "generated/build/test"),
  path.join(fixtureDir, "generated/src"),
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [path.join(fixtureDir, "held/pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(fixtureDir, "held/package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(fixtureDir, "held/packages/alpha/package.json"), '{ "name": "alpha" }\n'],
  [path.join(fixtureDir, "held/packages/alpha/test/order.test.ts"), MODULE_SOURCE],
  [path.join(fixtureDir, "held/packages/alpha/test/order.assets.ts"), MODULE_SOURCE],
  [heldSource, MODULE_SOURCE],
  [path.join(fixtureDir, "carved/pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(fixtureDir, "carved/package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(fixtureDir, "carved/packages/alpha/package.json"), '{ "name": "alpha" }\n'],
  [path.join(fixtureDir, "carved/packages/alpha/test/order.test.ts"), MODULE_SOURCE],
  [path.join(fixtureDir, "carved/packages/alpha/test/helpers.ts"), MODULE_SOURCE],
  [carvedSource, MODULE_SOURCE],
  [path.join(fixtureDir, "carved/packages/beta/package.json"), '{ "name": "beta" }\n'],
  [untouchedSource, MODULE_SOURCE],
  [path.join(fixtureDir, "nested/pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(fixtureDir, "nested/package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(fixtureDir, "nested/test/orders/held.ts"), MODULE_SOURCE],
  [nestedSource, MODULE_SOURCE],
  [path.join(fixtureDir, "stemless/pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(fixtureDir, "stemless/package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(fixtureDir, "stemless/test/assets.ts"), MODULE_SOURCE],
  [stemlessSource, MODULE_SOURCE],
  [path.join(fixtureDir, "renamed/pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(fixtureDir, "renamed/package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(fixtureDir, "renamed/cases/order.spec.ts"), MODULE_SOURCE],
  [path.join(fixtureDir, "renamed/cases/order.data.ts"), MODULE_SOURCE],
  [path.join(fixtureDir, "renamed/cases/helpers.ts"), MODULE_SOURCE],
  [renamedSource, MODULE_SOURCE],
  [path.join(fixtureDir, "generated/pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(fixtureDir, "generated/package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(fixtureDir, "generated/build/test/helpers.ts"), MODULE_SOURCE],
  [generatedSource, MODULE_SOURCE],
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

describe("dont-review-it/require-spec-or-assets-only-in-spec-directory--move-out-or-inline", () => {
  testLintRule(requireSpecOrAssetsOnlyInSpecDirectory, {
    valid: [
      {
        name: "a spec directory holding only specs and their test data asks for nothing",
        code: MODULE_SOURCE,
        filename: heldSource,
      },
      {
        name: "a workspace apart from the one holding the carved file is left alone",
        code: MODULE_SOURCE,
        filename: untouchedSource,
      },
      {
        name: "a directory named outside the spec directory names holds what it likes",
        code: MODULE_SOURCE,
        filename: renamedSource,
      },
      {
        name: "a repository that spells its spec directory and its specs differently keeps its own spelling",
        code: MODULE_SOURCE,
        filename: heldSource,
        options: RENAMED_CONVENTION,
      },
      {
        name: "a directory declared unscanned is walked past",
        code: MODULE_SOURCE,
        filename: generatedSource,
        options: [{ unscannedDirectories: ["build"] }],
      },
    ],
    invalid: [
      {
        name: "a file that is neither a spec nor test data is reported against the workspace holding it",
        documented: true,
        code: MODULE_SOURCE,
        filename: carvedSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "packages/alpha/test",
              foreignPath: "packages/alpha/test/helpers.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
      {
        name: "a file nested under a directory inside a spec directory is reported as well",
        code: MODULE_SOURCE,
        filename: nestedSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "test",
              foreignPath: "test/orders/held.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
      {
        name: "a file carrying the test data marker without a stem in front of it is a third kind",
        code: MODULE_SOURCE,
        filename: stemlessSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "test",
              foreignPath: "test/assets.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
      {
        name: "the spec directory names a repository declares decide what is walked",
        code: MODULE_SOURCE,
        filename: renamedSource,
        options: RENAMED_CONVENTION,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "cases",
              foreignPath: "cases/helpers.ts",
              specNames: "`*.spec.ts`",
              assetsNames: "`*.data.*`",
            },
          },
        ],
      },
      {
        name: "a directory left in the walk carries its spec directory into the report",
        code: MODULE_SOURCE,
        filename: generatedSource,
        errors: [
          {
            messageId: "foreignFileInSpecDirectory",
            data: {
              specDirectory: "build/test",
              foreignPath: "build/test/helpers.ts",
              specNames: SPEC_NAMES,
              assetsNames: ASSETS_NAMES,
            },
          },
        ],
      },
    ],
  });
});
