import { NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { forbidTrackedPath } from "./forbid-tracked-path--untrack-and-ignore.ts";

const HOST_CODE = "export const total = 1;";

const EVERY_DEFAULT_LISTED = "node_modules\ndist\ncoverage\n.env\n";

const HOST_FILE_NAME = "vite.config.ts";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const HELD_BY_THE_FIXTURE = "held by the fixture\n";

type FixtureRepository = {
  readonly ignoreListing: string | null;
  readonly tracked: readonly string[];
  readonly untracked: readonly string[];
  readonly versioned: boolean;
};

const FIXTURE_REPOSITORIES: Readonly<Record<string, FixtureRepository>> = {
  clean: {
    ignoreListing: EVERY_DEFAULT_LISTED,
    tracked: ["src/index.ts"],
    untracked: [],
    versioned: true,
  },
  "untracked-env": {
    ignoreListing: EVERY_DEFAULT_LISTED,
    tracked: ["src/index.ts"],
    untracked: [".env"],
    versioned: true,
  },
  "tracked-outside": {
    ignoreListing: EVERY_DEFAULT_LISTED,
    tracked: ["README.md"],
    untracked: [],
    versioned: true,
  },
  "spelled-differently": {
    ignoreListing: "node_modules/\ndist/*\n/coverage\n**/.env\n",
    tracked: ["src/index.ts"],
    untracked: [],
    versioned: true,
  },
  "tracked-env": {
    ignoreListing: EVERY_DEFAULT_LISTED,
    tracked: [".env"],
    untracked: [],
    versioned: true,
  },
  "tracked-build-output": {
    ignoreListing: EVERY_DEFAULT_LISTED,
    tracked: ["packages/reader/dist/index.js"],
    untracked: [],
    versioned: true,
  },
  vendored: {
    ignoreListing: `${EVERY_DEFAULT_LISTED}vendor\n`,
    tracked: ["vendor/build.js"],
    untracked: [],
    versioned: true,
  },
  "missing-listing": {
    ignoreListing: "node_modules\ndist\ncoverage\n",
    tracked: ["src/index.ts"],
    untracked: [],
    versioned: true,
  },
  "negated-listing": {
    ignoreListing: "node_modules\ndist\ncoverage\n!.env\n",
    tracked: ["src/index.ts"],
    untracked: [],
    versioned: true,
  },
  "without-ignore-settings": {
    ignoreListing: null,
    tracked: ["src/index.ts"],
    untracked: [],
    versioned: true,
  },
  "without-version-control": {
    ignoreListing: EVERY_DEFAULT_LISTED,
    tracked: [],
    untracked: [".env"],
    versioned: false,
  },
};

const fixtureDir = await Effect.gen(function* writeFixture() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const gitEnvironment = {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    HOME: yield* Config.String("HOME"),
    PATH: yield* Config.String("PATH"),
  };
  const git = (cwd: string, args: readonly string[]) =>
    spawner
      .exitCode(
        ChildProcess.make("git", [...args], {
          cwd,
          env: gitEnvironment,
          extendEnv: false,
          stdout: "ignore",
          stderr: "ignore",
        }),
      )
      .pipe(Effect.filterOrFail((exitCode) => exitCode === 0));
  const root = yield* filesystem.makeTempDirectory({
    prefix: "dont-review-it-forbid-tracked-path-",
  });
  for (const [name, repository] of Object.entries(FIXTURE_REPOSITORIES)) {
    const repositoryDir = paths.join(root, name);
    yield* filesystem.makeDirectory(repositoryDir, { recursive: true });
    yield* filesystem.writeFileString(
      paths.join(repositoryDir, "pnpm-workspace.yaml"),
      WORKSPACE_MANIFEST,
    );
    if (repository.ignoreListing !== null) {
      yield* filesystem.writeFileString(
        paths.join(repositoryDir, ".gitignore"),
        repository.ignoreListing,
      );
    }
    for (const heldPath of [...repository.tracked, ...repository.untracked]) {
      yield* filesystem.makeDirectory(paths.dirname(paths.join(repositoryDir, heldPath)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(repositoryDir, heldPath), HELD_BY_THE_FIXTURE);
    }
    if (repository.versioned) {
      yield* git(repositoryDir, ["init"]);
      yield* git(repositoryDir, ["add", "-f", "--", ...repository.tracked]);
    }
  }
  return root;
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const clean = path.join(fixtureDir, "clean");
const untrackedEnv = path.join(fixtureDir, "untracked-env");
const trackedOutsideEveryPattern = path.join(fixtureDir, "tracked-outside");
const spelledDifferently = path.join(fixtureDir, "spelled-differently");
const trackedEnv = path.join(fixtureDir, "tracked-env");
const trackedBuildOutput = path.join(fixtureDir, "tracked-build-output");
const vendored = path.join(fixtureDir, "vendored");
const missingListing = path.join(fixtureDir, "missing-listing");
const negatedListing = path.join(fixtureDir, "negated-listing");
const withoutIgnoreSettings = path.join(fixtureDir, "without-ignore-settings");
const withoutVersionControl = path.join(fixtureDir, "without-version-control");

const vendorRow = {
  pattern: "vendor/**",
  reason: "the upstream ships no source for this bundle",
};

describe("dont-review-it/forbid-tracked-path--untrack-and-ignore", () => {
  testLintRule(forbidTrackedPath, {
    valid: [
      {
        name: "a repository that tracks nothing under a registered pattern passes",
        code: HOST_CODE,
        filename: path.join(clean, HOST_FILE_NAME),
      },
      {
        name: "an untracked file of the same name is left where it stands",
        code: HOST_CODE,
        filename: path.join(untrackedEnv, HOST_FILE_NAME),
      },
      {
        name: "a tracked path outside every registered pattern is left alone",
        code: HOST_CODE,
        filename: path.join(trackedOutsideEveryPattern, HOST_FILE_NAME),
      },
      {
        name: "an ignore entry spelled with a directory slash or an anchor still covers the row",
        code: HOST_CODE,
        filename: path.join(spelledDifferently, HOST_FILE_NAME),
      },
      {
        name: "a tracked path covered by an exception that carries grounds is left alone",
        code: HOST_CODE,
        filename: path.join(vendored, HOST_FILE_NAME),
        options: [
          {
            forbidden: [
              {
                ...vendorRow,
                exceptions: [
                  { pattern: "vendor/**", reason: "the bundle is the shipped artifact" },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "a release that carries grounds lifts the registered row",
        code: HOST_CODE,
        filename: path.join(trackedEnv, HOST_FILE_NAME),
        options: [
          { released: [{ pattern: "**/.env", reason: "this repository ships no runtime" }] },
        ],
      },
      {
        name: "a row that asks for no ignore entry passes without one",
        code: HOST_CODE,
        filename: path.join(clean, HOST_FILE_NAME),
        options: [
          {
            forbidden: [
              {
                pattern: "**/scratch/**",
                reason: "scratch output stays visible in the status output",
                ignoreListing: false,
              },
            ],
          },
        ],
      },
      {
        name: "a working tree outside version control carries no tracked path",
        code: HOST_CODE,
        filename: path.join(withoutVersionControl, HOST_FILE_NAME),
      },
      {
        name: "a file below the workspace root reports nothing",
        code: HOST_CODE,
        filename: path.join(trackedEnv, "src", "index.ts"),
      },
    ],
    invalid: [
      {
        name: "an environment file that reached the index is reported",
        documented: true,
        code: HOST_CODE,
        filename: path.join(trackedEnv, HOST_FILE_NAME),
        errors: [{ messageId: "trackedForbiddenPath" }],
      },
      {
        name: "build output that reached the index is reported",
        code: HOST_CODE,
        filename: path.join(trackedBuildOutput, HOST_FILE_NAME),
        errors: [{ messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a registered pattern missing from the ignore settings is reported",
        code: HOST_CODE,
        filename: path.join(missingListing, HOST_FILE_NAME),
        errors: [{ messageId: "unignoredForbiddenPattern" }],
      },
      {
        name: "a negated ignore entry does not list the pattern",
        code: HOST_CODE,
        filename: path.join(negatedListing, HOST_FILE_NAME),
        errors: [{ messageId: "unignoredForbiddenPattern" }],
      },
      {
        name: "a repository without ignore settings leaves every registered pattern unlisted",
        code: HOST_CODE,
        filename: path.join(withoutIgnoreSettings, HOST_FILE_NAME),
        errors: [
          { messageId: "unignoredForbiddenPattern" },
          { messageId: "unignoredForbiddenPattern" },
          { messageId: "unignoredForbiddenPattern" },
          { messageId: "unignoredForbiddenPattern" },
        ],
      },
      {
        name: "an exception whose reason is empty is reported and excuses nothing",
        code: HOST_CODE,
        filename: path.join(vendored, HOST_FILE_NAME),
        options: [
          { forbidden: [{ ...vendorRow, exceptions: [{ pattern: "vendor/**", reason: "" }] }] },
        ],
        errors: [{ messageId: "groundlessException" }, { messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a release whose reason is empty is reported and lifts nothing",
        code: HOST_CODE,
        filename: path.join(trackedEnv, HOST_FILE_NAME),
        options: [{ released: [{ pattern: "**/.env", reason: "" }] }],
        errors: [{ messageId: "groundlessRelease" }, { messageId: "trackedForbiddenPath" }],
      },
      {
        name: "a release naming a pattern no row carries is reported",
        code: HOST_CODE,
        filename: path.join(clean, HOST_FILE_NAME),
        options: [
          { released: [{ pattern: "**/nowhere/**", reason: "the row moved to another table" }] },
        ],
        errors: [{ messageId: "deadRelease" }],
      },
      {
        name: "a groundless release of a pattern outside the defaults is reported twice over",
        code: HOST_CODE,
        filename: path.join(clean, HOST_FILE_NAME),
        options: [{ released: [{ pattern: "**/nowhere/**", reason: "" }] }],
        errors: [{ messageId: "groundlessRelease" }, { messageId: "deadRelease" }],
      },
      {
        name: "a release of a row the configuration itself added is dead and lifts nothing",
        code: HOST_CODE,
        filename: path.join(vendored, HOST_FILE_NAME),
        options: [
          {
            forbidden: [vendorRow],
            released: [{ pattern: "vendor/**", reason: "the bundle is the shipped artifact" }],
          },
        ],
        errors: [{ messageId: "deadRelease" }, { messageId: "trackedForbiddenPath" }],
      },
    ],
  });
});
