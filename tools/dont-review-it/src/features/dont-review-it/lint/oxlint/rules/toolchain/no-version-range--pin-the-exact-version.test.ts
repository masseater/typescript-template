import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { loadCatalogEntries } from "../../lib/dependency-catalog/catalog-entries.ts";
import { loadWorkspaceDependencies } from "../../lib/dependency-catalog/workspace-manifests.ts";
import { createNoVersionRange } from "./no-version-range--pin-the-exact-version.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({ prefix: "dont-review-it-no-version-range-" });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const MODULE_SOURCE = "export const shipped = true;\n";

const SOURCE_BY_FIXTURE_PATH: Readonly<Record<string, string>> = {
  "ranged/pnpm-workspace.yaml":
    "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n  typescript: 7.0.2\n",
  "ranged/package.json": `${JSON.stringify(
    { name: "root", devDependencies: { knip: "^6.32.0", citty: "0.2.2" } },
    null,
    2,
  )}\n`,
  "ranged/packages/alpha/package.json": `${JSON.stringify(
    {
      name: "alpha",
      dependencies: {
        "es-toolkit": "catalog:",
        "@fixture/utils": "workspace:*",
        linked: "link:../shared-lib",
        filed: "file:../shared-lib",
        pad: "npm:left-pad@^1.0.0",
        aliased: "npm:right-pad@2.0.0",
        tagged: "latest",
        hosted: "github:owner/repo",
      },
      peerDependencies: { "peer-only": "^1.0.0" },
    },
    null,
    2,
  )}\n`,
  "ranged/packages/beta/package.json": `${JSON.stringify(
    {
      name: "beta",
      dependencies: { solid: "1.9.9" },
      optionalDependencies: { opt: "~4.0.0" },
    },
    null,
    2,
  )}\n`,
  "ranged/entry.ts": MODULE_SOURCE,
  "ranged/packages/alpha/entry.ts": MODULE_SOURCE,
  "ranged/packages/beta/entry.ts": MODULE_SOURCE,
  "exact/pnpm-workspace.yaml":
    "packages:\n  - packages/*\ncatalog:\n  typescript: 7.0.2\n  oxfmt: 0.61.0-beta.1\n",
  "exact/package.json": `${JSON.stringify(
    { name: "exact-root", devDependencies: { citty: "0.2.2" } },
    null,
    2,
  )}\n`,
  "exact/packages/one/package.json": `${JSON.stringify(
    { name: "one", dependencies: { "es-toolkit": "1.50.0", yaml: "2.9.0" } },
    null,
    2,
  )}\n`,
  "exact/entry.ts": MODULE_SOURCE,
  "exact/packages/one/entry.ts": MODULE_SOURCE,
  "no-definition/package.json": `${JSON.stringify(
    { name: "definitionless", workspaces: [], devDependencies: { citty: "0.2.2" } },
    null,
    2,
  )}\n`,
  "no-definition/entry.ts": MODULE_SOURCE,
  "unparsable/pnpm-workspace.yaml": "packages: [packages/*\n",
  "unparsable/package.json": `${JSON.stringify(
    { name: "unparsable-root", devDependencies: { citty: "0.2.2" } },
    null,
    2,
  )}\n`,
  "unparsable/entry.ts": MODULE_SOURCE,
  "manifestless/pnpm-workspace.yaml": "packages: []\n",
  "manifestless/loose.ts": MODULE_SOURCE,
};

await Effect.gen(function* writeFixture() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  for (const [fixturePath, fixtureSource] of Object.entries(SOURCE_BY_FIXTURE_PATH)) {
    yield* filesystem.makeDirectory(paths.dirname(paths.join(fixtureDir, fixturePath)), {
      recursive: true,
    });
    yield* filesystem.writeFileString(paths.join(fixtureDir, fixturePath), fixtureSource);
  }
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const rangedRootEntry = path.join(fixtureDir, "ranged/entry.ts");
const alphaEntry = path.join(fixtureDir, "ranged/packages/alpha/entry.ts");
const betaEntry = path.join(fixtureDir, "ranged/packages/beta/entry.ts");
const exactRootEntry = path.join(fixtureDir, "exact/entry.ts");
const exactMemberEntry = path.join(fixtureDir, "exact/packages/one/entry.ts");
const definitionlessEntry = path.join(fixtureDir, "no-definition/entry.ts");
const unparsableEntry = path.join(fixtureDir, "unparsable/entry.ts");
const manifestlessEntry = path.join(fixtureDir, "manifestless/loose.ts");

const INTENTIONAL = [{ intentionalRanges: ["knip", "react"] }];

const noVersionRange = createNoVersionRange({
  loadWorkspaces: loadWorkspaceDependencies,
  loadCatalog: loadCatalogEntries,
});

describe("dont-review-it/no-version-range--pin-the-exact-version", () => {
  testLintRule(noVersionRange, {
    valid: [
      {
        name: "a repository whose manifests and catalog all spelled one release passes",
        code: MODULE_SOURCE,
        filename: exactRootEntry,
      },
      {
        name: "a workspace declaring references, an exact alias, a tag and a host passes",
        code: MODULE_SOURCE,
        filename: exactMemberEntry,
      },
      {
        name: "names registered as intentional ranges are not asked to be pinned",
        code: MODULE_SOURCE,
        filename: rangedRootEntry,
        options: INTENTIONAL,
      },
      {
        name: "a repository without a workspace definition holds no catalog to read",
        code: MODULE_SOURCE,
        filename: definitionlessEntry,
      },
      {
        name: "a workspace definition that does not parse yields no catalog entries",
        code: MODULE_SOURCE,
        filename: unparsableEntry,
      },
      {
        name: "a file no manifest governs belongs to no workspace",
        code: MODULE_SOURCE,
        filename: manifestlessEntry,
      },
    ],
    invalid: [
      {
        name: "the root workspace carries both its own ranges and the ones the catalog registers",
        documented: true,
        code: MODULE_SOURCE,
        filename: rangedRootEntry,
        errors: [
          {
            messageId: "rangedManifestVersion",
            data: { packageName: "knip", declaredVersion: "^6.32.0", workspace: "." },
          },
          {
            messageId: "rangedCatalogVersion",
            data: { packageName: "react", declaredVersion: "^19.0.0" },
          },
        ],
      },
      {
        name: "an alias carrying a range is reported under the package it resolves to",
        code: MODULE_SOURCE,
        filename: alphaEntry,
        errors: [
          {
            messageId: "rangedManifestVersion",
            data: {
              packageName: "left-pad",
              declaredVersion: "npm:left-pad@^1.0.0",
              workspace: "packages/alpha",
            },
          },
        ],
      },
      {
        name: "an optional dependency carries the same demand and brings no catalog report",
        code: MODULE_SOURCE,
        filename: betaEntry,
        errors: [
          {
            messageId: "rangedManifestVersion",
            data: {
              packageName: "opt",
              declaredVersion: "~4.0.0",
              workspace: "packages/beta",
            },
          },
        ],
      },
    ],
  });
});
