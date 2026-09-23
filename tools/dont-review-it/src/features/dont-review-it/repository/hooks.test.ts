import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { lifecycleInherits, lifecycles } from "@repo/vite-config";
import { Effect, FileSystem, Path, Schema, type PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";

import { directoryEntries } from "./directory-entries.ts";
import { frozenOnDemandGateEntries, onDemandGateEntries } from "./on-demand-checks.ts";
import {
  commands,
  configuredDirectories,
  dependencies,
  reachable,
  reachableAcross,
  scriptNames,
  taskNames,
  testProjectDirectories,
  uncachedGateTasks,
  workspaceDirectories,
  workspaceNames,
} from "./tasks.ts";
import { dedicatedToolVitestProjects, rootNodeToolTestIncludes } from "./tool-test-projects.ts";

const hooks: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../../../.vite-hooks/pre-*",
  {
    eager: true,
    import: "default",
  },
);

const workflows: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../../../.github/workflows/*.yml",
  { eager: true, import: "default" },
);

const mergifyConfigs: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../../../.mergify.yml",
  { eager: true, import: "default" },
);

const pnpmWorkspaces: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../../../pnpm-workspace.yaml",
  { eager: true, import: "default" },
);

const gatedTask = /^(?:build|check|verify)(?::|$)/u;
const minuteLongCommands = ["vp run", "vp test", "vp build", "vp pack"];
const lifecycleWorkflows = new Set(["check.yml", "prerelease.yml"]);

const hookStages = Object.entries(hooks).map(
  ([file, source]) => [file.replace(/^.*\/pre-/u, "pre"), source] as const,
);

function misplacedHooks(): string[] {
  return hookStages
    .filter(
      ([stage, source]) =>
        !lifecycles.some((name) => name === stage) ||
        source !==
          [
            `scope="$(node tools/dont-review-it/src/features/dont-review-it/repository/hook-scope.ts ${stage})" || scope="-r"`,
            '[ -n "$scope" ] || exit 0',
            `vp run --concurrency-limit ${stage === "prepush" ? "1" : "2"} $scope ${stage}`,
            "",
          ].join("\n"),
    )
    .map(([stage]) => stage);
}

function workflowRuns(file: string): string[] {
  const workflow = workflows[file];
  if (workflow === undefined) {
    throw new Error(`${file} is missing`);
  }
  const step = /^\s*(?:- )?run: /u;
  return (workflow.match(/^\s*(?:- )?run: .+$/gmu) ?? [])
    .map((line: string) => line.replace(step, ""))
    .filter((command: string) => command.startsWith("vp "));
}

function lifecycleByJob(file: string): Readonly<Record<string, string[]>> {
  const workflow = workflows[file];
  if (workflow === undefined) {
    throw new Error(`${file} is missing`);
  }
  const [, declared = ""] = /^jobs:$(?<declared>[\s\S]*)/mu.exec(workflow) ?? [];
  const [, ...jobs] = declared.split(/^ {2}(?<job>[\w-]+):$/mu);
  return Object.fromEntries(
    jobs.flatMap((entry, index, all) =>
      index % 2 === 0
        ? [
            [
              entry,
              [
                ...(all[index + 1] ?? "").matchAll(
                  /^\s*(?:- )?run: (?<command>vp run -r \w+(?: .+)?)$/gmu,
                ),
              ]
                .map((match) => match[1] ?? "")
                .toSorted(),
            ],
          ]
        : [],
    ),
  );
}

function lifecycleOutsideGates(): string[] {
  return Object.keys(workflows)
    .filter((file) => ![...lifecycleWorkflows].some((name) => file.endsWith(name)))
    .flatMap((file) => workflowRuns(file).filter((command) => command.startsWith("vp run -r ")));
}

function brokenChain(directory: string): string[] {
  const stages = new Set<string>(lifecycles);
  return lifecycles.flatMap((name) => {
    const inherited = dependencies(directory, name).filter((dependency) => stages.has(dependency));
    const chained =
      taskNames(directory).includes(name) &&
      commands(directory, name).length === 0 &&
      inherited.toSorted().join(",") === [...lifecycleInherits[name]].toSorted().join(",");
    return chained ? [] : [`${directory}: ${name}`];
  });
}

function scriptedGate(directory: string): string[] {
  const scripts = new Set(scriptNames(directory));
  return reachable(directory, [...lifecycles])
    .filter((name) => scripts.has(name))
    .map((name) => `${directory}: ${name}`);
}

function ungated(directory: string): string[] {
  const gate = new Set(reachable(directory, ["prerelease"]));
  return [...taskNames(directory), ...scriptNames(directory)]
    .filter((name) => gatedTask.test(name) && !gate.has(name))
    .map((name) => `${directory}: ${name}`)
    .filter((entry) => !onDemandGateEntries.has(entry));
}

function slowBeforePush(directory: string): string[] {
  const unresolved = reachable(directory, ["prepush"]).filter((name) => name.startsWith("*#"));
  const slow = reachableAcross(directory, "prepush").filter((entry) => {
    const [owner = "", name = ""] = entry.split("#");
    return commands(owner, name).some((command) =>
      minuteLongCommands.some((prefix) => command.startsWith(prefix)),
    );
  });
  return [...unresolved, ...slow].map((name) => `${directory}: ${name}`);
}

function reachesTest(directory: string, stages: string[]): boolean {
  return reachable(directory, stages).some((name) => name === "test" || name.startsWith("test:"));
}

function filterCoveredTestProjects(): Set<string> {
  const packages = new Set(
    workflowRuns("../../../../../../.github/workflows/check.yml").flatMap((command) => {
      const match = /^vp run --filter (@repo\/[\w-]+) (test(?::[\w-]+)?)$/u.exec(command);
      return match?.[1] === undefined ? [] : [match[1]];
    }),
  );
  return new Set(
    testProjectDirectories.filter((directory) => packages.has(workspaceNames[directory] ?? "")),
  );
}

function ungatedProjects(): string[] {
  const covered = filterCoveredTestProjects();
  return testProjectDirectories.filter(
    (directory) => !reachesTest(directory, ["prepr", "premerge"]) && !covered.has(directory),
  );
}

function strayTestTasks(): string[] {
  return configuredDirectories.filter(
    (directory) =>
      directory !== "." &&
      !testProjectDirectories.includes(directory) &&
      taskNames(directory).includes("test"),
  );
}

function unmatchedProjectNames(): string[] {
  return testProjectDirectories.filter(
    (directory) => !(workspaceNames[directory] ?? "").startsWith("@repo/"),
  );
}

const toolsRoot = fileURLToPath(new URL("../../../../../../tools", import.meta.url));

type TreeScan<Scanned> = Effect.Effect<
  Scanned,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
>;

const collectTestPackages = (directory: string, packageName: string): TreeScan<string[]> =>
  Effect.gen(function* scanTestPackages() {
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(directory);
    const found = yield* Effect.forEach(entries, (entry): TreeScan<string[]> => {
      if (entry.kind === "directory") {
        return collectTestPackages(paths.join(directory, entry.name), packageName);
      }
      return Effect.succeed(/\.test\.tsx?$/u.test(entry.name) ? [packageName] : []);
    });
    return found.flat();
  });

const toolsPackagesWithTests: TreeScan<string[]> = Effect.gen(function* toolsPackagesWithTests() {
  const paths = yield* Path.Path;
  const entries = yield* directoryEntries(toolsRoot);
  const found = yield* Effect.forEach(
    entries.filter((entry) => entry.kind === "directory"),
    (entry) => collectTestPackages(paths.join(toolsRoot, entry.name), `tools/${entry.name}`),
  );
  return [...new Set(found.flat())].toSorted();
});

const uncoveredToolTestPackages = (packagesWithTests: readonly string[]): string[] => {
  const dedicated = new Set(dedicatedToolVitestProjects.map((path) => path.replace(/^\.\//u, "")));
  const rootOwned = new Set(
    rootNodeToolTestIncludes.map((pattern) => pattern.replace(/\/\*\*\/\*\.test\.tsx?$/u, "")),
  );
  return packagesWithTests.filter(
    (directory) =>
      !dedicated.has(directory) &&
      !rootOwned.has(directory) &&
      !reachesTest(directory, ["prepr", "premerge"]),
  );
};

const repositoryRoot = fileURLToPath(new URL("../../../../../..", import.meta.url));

const CursorEnvironment = Schema.fromJsonString(Schema.Unknown);

describe("cloud agent environment", () => {
  it("installs dependencies and reconnects pre-push through the agent hook dispatcher", () =>
    Effect.runPromise(
      Effect.gen(function* cloudAgentEnvironment() {
        expect.hasAssertions();
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const environment = yield* Schema.decodeEffect(CursorEnvironment)(
          yield* filesystem.readFileString(paths.join(repositoryRoot, ".cursor/environment.json")),
        );
        expect(environment).toStrictEqual({
          install: "bash .cursor/install.sh",
          start: "bash .cursor/start.sh",
        });
        const install = yield* filesystem.readFileString(
          paths.join(repositoryRoot, ".cursor/install.sh"),
        );
        const start = yield* filesystem.readFileString(
          paths.join(repositoryRoot, ".cursor/start.sh"),
        );
        expect(install).toContain("mise.run");
        expect(install).toContain("mise install");
        expect(install).toContain("seed-mergify-auth.sh");
        expect(install).toContain("vp install");
        expect(start).toContain("seed-mergify-auth.sh");
        expect(start).toContain("materialize:env");
        expect(start).toContain("pre-push");
        expect(start).toContain(".cursor-original-hooks-path");
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});

describe("lifecycle entry points", () => {
  it("each hook runs its lifecycle task in the workspaces its change reaches", () => {
    expect.hasAssertions();
    expect(hookStages.length).toBeGreaterThan(0);
    expect(misplacedHooks()).toStrictEqual([]);
  });

  it("gives a pull request the pr gate and leaves merge and release to their own gates", () => {
    expect.hasAssertions();
    expect(lifecycleByJob("../../../../../../.github/workflows/check.yml")).toStrictEqual({
      cache: ["vp run -r prepr"],
      check: [],
      "check-shard": [],
      e2e: [],
      "merge-queue": [],
      "merge-queue-packages": ["vp run -r premerge"],
      "merge-queue-unit": [],
    });
    expect(lifecycleByJob("../../../../../../.github/workflows/prerelease.yml")).toStrictEqual({
      load: [],
      prerelease: ["vp run -r prerelease"],
    });
    expect(lifecycleOutsideGates()).toStrictEqual([]);
  });

  it("runs the repository check once inside prepr and the unit suite on the merge queue", () => {
    expect.hasAssertions();
    expect(workflowRuns("../../../../../../.github/workflows/check.yml")).toStrictEqual([
      "vp run -w prepr",
      "vp run --fail-if-no-match $AFFECTED_FILTERS prepr",
      "vp test run --passWithNoTests --project '!@repo/*' --exclude '**/*.dev-server.test.ts' $AFFECTED_PATHS",
      "vp run -r premerge",
      "vp run compile:paraglide",
      "vp test run --project node --project node-isolated --project workers --shard=${{ matrix.shard }}/4",
      "vp run --filter @repo/e2e test:e2e",
      "vp run -r prepr",
    ]);
  });

  it("every workspace declares its tasks where the lifecycle finds them", () => {
    expect.hasAssertions();
    expect(pnpmWorkspaces["../../../../../../pnpm-workspace.yaml"]).toMatch(
      /^packages:\n {2}- apps\/\*\n {2}- libs\/\*\n {2}- infra\/\*\n {2}- tools\/\*\n(?! {2}-)/u,
    );
    expect(configuredDirectories).toStrictEqual(workspaceDirectories);
  });
});

describe("lifecycle contents", () => {
  it("every workspace inherits the stages its gate is declared to inherit", () => {
    expect.hasAssertions();
    expect(configuredDirectories.flatMap((directory) => brokenChain(directory))).toStrictEqual([]);
  });

  it("the release gate reaches every check, build and verification", () => {
    expect.hasAssertions();
    expect(configuredDirectories.flatMap((directory) => ungated(directory))).toStrictEqual([]);
  });

  it("runs every gated check as a task so it can be cached", () => {
    expect.hasAssertions();
    expect(configuredDirectories.flatMap((directory) => scriptedGate(directory))).toStrictEqual([]);
  });

  it("replays every release gate task from the cache but the ones still tied to run time state", () => {
    expect.hasAssertions();
    expect(uncachedGateTasks()).toStrictEqual([
      ".#mutation",
      ".#test:dev-server",
      ".#test:storybook",
      "apps/internal-dashboard#check:dev",
      "apps/service-admin#check:dev",
      "apps/service-member#check:dev",
      "infra/cloudflare#verify:account",
      "tools/dev#check:exported",
      "tools/dev#setup",
      "tools/dont-review-it#check:staged",
    ]);
  });

  it("checks staged secrets before a commit", () => {
    expect.hasAssertions();
    expect(
      configuredDirectories.filter((directory) =>
        reachable(directory, ["precommit"]).includes("check:staged"),
      ),
    ).toStrictEqual(["tools/dont-review-it"]);
  });

  it("runs static analysis on push and leaves tests and builds to later gates", () => {
    expect.hasAssertions();
    expect(dependencies(".", "precommit")).toContain("check:text");
    expect(commands(".", "check:text")).toStrictEqual([
      'textlint "apps/internal-dashboard/content/docs/**/*.md"',
    ]);
    expect(reachable(".", ["prepr"])).toContain("check:text");
    expect(reachable(".", ["prepush"])).toStrictEqual(
      expect.arrayContaining(["check:effect", "knip", "check:canonical-literal-types"]),
    );
    expect(reachable(".", ["prepush"])).not.toContain("test");
    expect(
      configuredDirectories.filter(
        (directory) => !reachable(directory, ["precommit"]).includes("check:code"),
      ),
    ).toStrictEqual([]);
    expect(
      configuredDirectories.filter(
        (directory) =>
          directory !== "." && !reachable(directory, ["prepush"]).includes("check:imports"),
      ),
    ).toStrictEqual([]);
    expect(
      configuredDirectories.filter((directory) =>
        ["check:client", "check:react"].some((name) =>
          reachable(directory, ["prepush"]).includes(name),
        ),
      ),
    ).toStrictEqual([
      "apps/internal-dashboard",
      "apps/internal-wiki",
      "apps/service-admin",
      "apps/service-member",
    ]);
    expect(
      configuredDirectories.flatMap((directory) =>
        taskNames(directory).includes("check:effect")
          ? commands(directory, "check:effect").filter((command) => command.includes("&&"))
          : [],
      ),
    ).toStrictEqual([]);
    expect(
      configuredDirectories.filter((directory) =>
        reachable(directory, ["prepush"]).includes("check"),
      ),
    ).toStrictEqual([
      "apps/internal-dashboard",
      "apps/internal-wiki",
      "apps/service-admin",
      "apps/service-member",
      "libs/db",
      "tools/ai-native",
      "tools/ai-native-telemetry",
      "tools/dont-review-it",
    ]);
    expect(configuredDirectories.flatMap((directory) => slowBeforePush(directory))).toStrictEqual(
      [],
    );
  });

  it("leaves every root entry outside the workspaces to the root check:code", () =>
    Effect.runPromise(
      Effect.gen(function* rootEntriesChecked() {
        expect.hasAssertions();
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const ignored = new Set([
          ".git",
          ...(yield* filesystem.readFileString(paths.join(repositoryRoot, ".gitignore")))
            .split("\n")
            .filter((line) => /^[\w.-]+\/?$/u.test(line))
            .map((line) => line.replace(/\/$/u, "")),
          ...workspaceDirectories.map((directory) => directory.split("/")[0]),
        ]);
        const checked = new Set(
          commands(".", "check:code").flatMap((command) => command.split(" ")),
        );
        expect(
          (yield* filesystem.readDirectory(repositoryRoot)).filter(
            (entry) => !ignored.has(entry) && !checked.has(entry),
          ),
        ).toStrictEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("type-checks a package before that package's bundle", () => {
    expect.hasAssertions();
    expect(
      configuredDirectories
        .filter((directory) => reachable(directory, ["prepr"]).includes("build"))
        .filter((directory) => !dependencies(directory, "build").includes("check:effect")),
    ).toStrictEqual([]);
  });
});

describe("test ownership", () => {
  it("every workspace vitest project runs from its own pull request gate", () => {
    expect.hasAssertions();
    expect(testProjectDirectories.length).toBeGreaterThan(0);
    expect(ungatedProjects()).toStrictEqual([]);
  });

  it("keeps a test task only where a workspace vitest project owns it", () => {
    expect.hasAssertions();
    expect(strayTestTasks()).toStrictEqual([]);
  });

  it("leaves the workspace projects out of the root test task", () => {
    expect.hasAssertions();
    expect(commands(".", "test")).toStrictEqual([
      "vp test run --project '!@repo/*' --exclude '**/*.dev-server.test.ts'",
    ]);
    expect(commands(".", "test:dev-server")).toStrictEqual([
      "vp test run --passWithNoTests --project dev-server",
    ]);
    expect(commands(".", "test:storybook")).toStrictEqual(["vp test run --project storybook"]);
    expect(unmatchedProjectNames()).toStrictEqual([]);
  });

  it("keeps every tools package with tests on a vitest project or pull request gate", () =>
    Effect.runPromise(
      Effect.gen(function* toolTestsOwned() {
        expect.hasAssertions();
        const packagesWithTests = yield* toolsPackagesWithTests;
        expect(packagesWithTests.length).toBeGreaterThan(0);
        expect(uncoveredToolTestPackages(packagesWithTests)).toStrictEqual([]);
        expect(testProjectDirectories).toStrictEqual(
          expect.arrayContaining(
            dedicatedToolVitestProjects.map((path) => path.replace(/^\.\//u, "")),
          ),
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});

describe("on-demand gate escapes", () => {
  it("keeps the on-demand allowlist frozen so new escapes need an explicit test change", () => {
    expect.hasAssertions();
    expect([...onDemandGateEntries].toSorted()).toStrictEqual([...frozenOnDemandGateEntries]);
  });
});

const Env = Schema.Record(Schema.String, Schema.Unknown);
const CheckWorkflow = Schema.Struct({
  jobs: Schema.Record(
    Schema.String,
    Schema.Struct({
      env: Schema.optionalKey(Env),
      steps: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({ env: Schema.optionalKey(Env), run: Schema.optionalKey(Schema.String) }),
        ),
      ),
    }),
  ),
});
const MergifyConfig = Schema.Struct({
  queue_rules: Schema.Array(
    Schema.Struct({
      merge_conditions: Schema.Array(Schema.Unknown),
      queue_conditions: Schema.Array(Schema.Unknown),
    }),
  ),
});

class SourceMissing extends Schema.TaggedError<SourceMissing>()("SourceMissing", {
  file: Schema.String,
}) {}

const parsedSource = <S extends Schema.ConstraintDecoder<unknown>>(
  sources: Readonly<Record<string, string>>,
  file: string,
  schema: S,
): Effect.Effect<S["Type"], SourceMissing | Schema.SchemaError> => {
  const source = sources[file];
  if (source === undefined) {
    return Effect.fail(new SourceMissing({ file }));
  }
  return Schema.decodeUnknownEffect(schema)(parse(source));
};

const checkWorkflow = await Effect.runPromise(
  parsedSource(workflows, "../../../../../../.github/workflows/check.yml", CheckWorkflow),
);

describe("mergify ci insights", () => {
  const jobs = Object.entries(checkWorkflow.jobs);

  it("hands MERGIFY_TOKEN to every job that runs vp, at the job level", () => {
    expect.hasAssertions();
    const vpJobs = jobs.filter(([, job]) =>
      (job.steps ?? []).some((step) => step.run?.includes("vp ")),
    );
    expect(vpJobs.length).toBeGreaterThan(0);
    expect(
      vpJobs
        .filter(([, job]) => job.env?.["MERGIFY_TOKEN"] !== "${{ secrets.MERGIFY_TOKEN }}")
        .map(([name]) => name),
    ).toStrictEqual([]);
    expect(
      jobs
        .filter(([, job]) =>
          (job.steps ?? []).some((step) => step.env?.["MERGIFY_TOKEN"] !== undefined),
        )
        .map(([name]) => name),
    ).toStrictEqual([]);
  });

  it("gates the merge queue only on checks the workflow defines", () =>
    Effect.runPromise(
      Effect.gen(function* mergeQueueGates() {
        expect.hasAssertions();
        const config = yield* parsedSource(
          mergifyConfigs,
          "../../../../../../.mergify.yml",
          MergifyConfig,
        );
        const gates = config.queue_rules
          .flatMap((rule) => [...rule.merge_conditions, ...rule.queue_conditions])
          .flatMap((condition) =>
            typeof condition === "string" && condition.startsWith("check-success = ")
              ? [condition.slice("check-success = ".length)]
              : [],
          );
        expect(gates.length).toBeGreaterThan(0);
        expect(gates.filter((gate) => checkWorkflow.jobs[gate] === undefined)).toStrictEqual([]);
      }),
    ));
});
