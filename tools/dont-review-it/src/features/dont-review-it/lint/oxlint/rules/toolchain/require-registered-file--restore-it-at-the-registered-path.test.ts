import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { path } from "../../../../platform/path.ts";
import { requireRegisteredFile } from "./require-registered-file--restore-it-at-the-registered-path.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({ prefix: "dont-review-it-require-registered-file-" });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const ROOT_PACKAGE_MANIFEST = '{ "name": "fixture" }\n';

const RELEASE_REASON = "the release notes are read from it";

const UNCHECKED_CONTENT =
  "What this file holds is read by no check, so this row asks only that it exists and holds something.";

const heldRepository = path.join(fixtureDir, "held");
const heldEntry = path.join(heldRepository, "entry.ts");

const absentRepository = path.join(fixtureDir, "absent");
const absentEntry = path.join(absentRepository, "entry.ts");

const emptiedRepository = path.join(fixtureDir, "emptied");
const emptiedEntry = path.join(emptiedRepository, "entry.ts");

const ownedRepository = path.join(fixtureDir, "owned");
const alphaWorkspace = path.join(ownedRepository, "packages/alpha");
const betaWorkspace = path.join(ownedRepository, "packages/beta");
const alphaEntry = path.join(alphaWorkspace, "entry.ts");
const betaEntry = path.join(betaWorkspace, "entry.ts");

const retiredRepository = path.join(fixtureDir, "retired");
const retiredEntry = path.join(retiredRepository, "entry.ts");

const unregisteredRepository = path.join(fixtureDir, "unregistered");
const unregisteredEntry = path.join(unregisteredRepository, "entry.ts");

const unmanagedDirectory = path.join(fixtureDir, "unmanaged");
const looseEntry = path.join(unmanagedDirectory, "loose.ts");

const CHANGELOG_ROW = [{ requiredFiles: [{ pattern: "CHANGELOG.md", reason: RELEASE_REASON }] }];

const README_ROW = [
  {
    requiredFiles: [
      {
        pattern: "README.md",
        owner: "packages/*",
        reason: RELEASE_REASON,
        contentChecks: ["no-lenient-coverage-threshold"],
      },
    ],
  },
];

const FIXTURE_DIRECTORIES: readonly string[] = [
  heldRepository,
  absentRepository,
  emptiedRepository,
  alphaWorkspace,
  betaWorkspace,
  retiredRepository,
  unregisteredRepository,
  unmanagedDirectory,
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [path.join(heldRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(heldRepository, "package.json"), ROOT_PACKAGE_MANIFEST],
  [
    path.join(heldRepository, "CHANGELOG.md"),
    "nothing a check reads, and enough to hold the row\n",
  ],
  [heldEntry, MODULE_SOURCE],
  [path.join(absentRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(absentRepository, "package.json"), ROOT_PACKAGE_MANIFEST],
  [absentEntry, MODULE_SOURCE],
  [path.join(emptiedRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(emptiedRepository, "package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(emptiedRepository, "CHANGELOG.md"), ""],
  [emptiedEntry, MODULE_SOURCE],
  [path.join(ownedRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(ownedRepository, "package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(alphaWorkspace, "package.json"), '{ "name": "alpha" }\n'],
  [path.join(alphaWorkspace, "README.md"), "what alpha publishes\n"],
  [path.join(betaWorkspace, "package.json"), '{ "name": "beta" }\n'],
  [alphaEntry, MODULE_SOURCE],
  [betaEntry, MODULE_SOURCE],
  [path.join(retiredRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(retiredRepository, "package.json"), ROOT_PACKAGE_MANIFEST],
  [retiredEntry, MODULE_SOURCE],
  [path.join(unregisteredRepository, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST],
  [path.join(unregisteredRepository, "package.json"), ROOT_PACKAGE_MANIFEST],
  [path.join(unregisteredRepository, "CHANGELOG.md"), "what shipped\n"],
  [unregisteredEntry, MODULE_SOURCE],
  [path.join(unmanagedDirectory, "pnpm-workspace.yaml"), "packages: []\n"],
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

describe("dont-review-it/require-registered-file--restore-it-at-the-registered-path", () => {
  testLintRule(requireRegisteredFile, {
    valid: [
      {
        name: "a table that registers nothing asks for nothing",
        code: MODULE_SOURCE,
        filename: absentEntry,
      },
      {
        name: "an empty table asks for nothing",
        code: MODULE_SOURCE,
        filename: absentEntry,
        options: [{ requiredFiles: [] }],
      },
      {
        name: "a registered path holding a file leaves the row met, whatever the file holds",
        code: MODULE_SOURCE,
        filename: heldEntry,
        options: CHANGELOG_ROW,
      },
      {
        name: "a path the table does not register is not asked for, absent though it is",
        code: MODULE_SOURCE,
        filename: unregisteredEntry,
        options: CHANGELOG_ROW,
      },
      {
        name: "a workspace that holds what its owner registered is left alone",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        options: README_ROW,
      },
      {
        name: "a file no manifest governs belongs to no workspace",
        code: MODULE_SOURCE,
        filename: looseEntry,
        options: CHANGELOG_ROW,
      },
    ],
    invalid: [
      {
        name: "a registered path with nothing at it is reported against the repository root",
        documented: true,
        code: MODULE_SOURCE,
        filename: absentEntry,
        options: CHANGELOG_ROW,
        errors: [
          {
            messageId: "missingRegisteredFile",
            data: {
              registeredPath: "CHANGELOG.md",
              holder: "the repository root",
              reason: RELEASE_REASON,
              contentGuarantee: UNCHECKED_CONTENT,
            },
          },
        ],
      },
      {
        name: "a registered path holding an empty file is reported as unmet as well",
        code: MODULE_SOURCE,
        filename: emptiedEntry,
        options: CHANGELOG_ROW,
        errors: [
          {
            messageId: "emptyRegisteredFile",
            data: {
              registeredPath: "CHANGELOG.md",
              holder: "the repository root",
              reason: RELEASE_REASON,
              contentGuarantee: UNCHECKED_CONTENT,
            },
          },
        ],
      },
      {
        name: "the workspace that lacks what its owner registered carries the report",
        code: MODULE_SOURCE,
        filename: betaEntry,
        options: README_ROW,
        errors: [
          {
            messageId: "missingRegisteredFile",
            data: {
              registeredPath: "packages/beta/README.md",
              holder: "`packages/beta`",
              reason: RELEASE_REASON,
              contentGuarantee:
                "What this file holds is read by `no-lenient-coverage-threshold`, so a file that merely exists leaves the row unmet.",
            },
          },
        ],
      },
      {
        name: "an owner that names no workspace is reported as a stale row",
        code: MODULE_SOURCE,
        filename: retiredEntry,
        options: README_ROW,
        errors: [
          {
            messageId: "deadOwnerRegistration",
            data: {
              registeredPath: "README.md",
              holder: "`packages/*`",
              reason: RELEASE_REASON,
            },
          },
        ],
      },
    ],
  });
});
