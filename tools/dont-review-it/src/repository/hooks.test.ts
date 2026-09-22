import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { lifecycleInherits, lifecycles } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

import { frozenOnDemandGateEntries, onDemandGateEntries } from "./on-demand-checks.ts";
import {
  commands,
  configuredDirectories,
  dependencies,
  reachable,
  scriptNames,
  taskNames,
  testProjectDirectories,
  uncachedGateTasks,
  workspaceDirectories,
  workspaceNames,
} from "./tasks.ts";
import { dedicatedToolVitestProjects, rootNodeToolTestIncludes } from "./tool-test-projects.ts";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const hooks: Readonly<Record<string, string>> = import.meta.glob("../../../../.vite-hooks/pre-*", {
  eager: true,
  import: "default",
});

const workflows: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../.github/workflows/*.yml",
  { eager: true, import: "default" },
);

const mergifyConfig = readFileSync(join(repositoryRoot, ".mergify.yml"), "utf8");

const pnpmWorkspaces: Readonly<Record<string, string>> = import.meta.glob(
  "../../../../pnpm-workspace.yaml",
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
        !lifecycles.some((name) => name === stage) || source !== `vp run -r ${stage}\n`,
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
  return reachable(directory, ["prepush"])
    .filter(
      (name) =>
        name.includes("#") ||
        commands(directory, name).some((command) =>
          minuteLongCommands.some((slow) => command.startsWith(slow)),
        ),
    )
    .map((name) => `${directory}: ${name}`);
}

function reachesTest(directory: string, stages: string[]): boolean {
  return reachable(directory, stages).some((name) => name === "test" || name.startsWith("test:"));
}

function filterCoveredTestProjects(): Set<string> {
  const packages = new Set(
    workflowRuns("../../../../.github/workflows/check.yml").flatMap((command) => {
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

const toolsRoot = fileURLToPath(new URL("../../../../tools", import.meta.url));

function collectTestPackages(directory: string, packageName: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTestPackages(path, packageName));
      continue;
    }
    if (/\.test\.tsx?$/u.test(entry.name)) {
      found.push(packageName);
    }
  }
  return found;
}

function toolsPackagesWithTests(): string[] {
  return [
    ...new Set(
      readdirSync(toolsRoot, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? collectTestPackages(join(toolsRoot, entry.name), `tools/${entry.name}`)
          : [],
      ),
    ),
  ].toSorted();
}

function uncoveredToolTestPackages(): string[] {
  const dedicated = new Set(dedicatedToolVitestProjects.map((path) => path.replace(/^\.\//u, "")));
  const rootOwned = new Set(
    rootNodeToolTestIncludes.map((pattern) => pattern.replace(/\/\*\*\/\*\.test\.tsx?$/u, "")),
  );
  return toolsPackagesWithTests().filter(
    (directory) =>
      !dedicated.has(directory) &&
      !rootOwned.has(directory) &&
      !reachesTest(directory, ["prepr", "premerge"]),
  );
}

describe("lifecycle entry points", () => {
  it("each hook runs its lifecycle task in every workspace", () => {
    expect.hasAssertions();
    expect(hookStages.length).toBeGreaterThan(0);
    expect(misplacedHooks()).toStrictEqual([]);
  });

  it("gives a pull request the pr gate and leaves merge and release to their own gates", () => {
    expect.hasAssertions();
    expect(lifecycleByJob("../../../../.github/workflows/check.yml")).toStrictEqual({
      cache: ["vp run -r prepr"],
      check: ["vp run -r prepr"],
      e2e: [],
      "merge-queue": ["vp run -r premerge"],
    });
    expect(lifecycleByJob("../../../../.github/workflows/prerelease.yml")).toStrictEqual({
      load: [],
      prerelease: ["vp run -r prerelease"],
    });
    expect(lifecycleOutsideGates()).toStrictEqual([]);
  });

  it("runs the repository check once inside prepr and the unit suite on the merge queue", () => {
    expect.hasAssertions();
    expect(workflowRuns("../../../../.github/workflows/check.yml")).toStrictEqual([
      "vp run -r prepr",
      "vp run -w prepr",
      "vp run --fail-if-no-match $AFFECTED_FILTERS prepr",
      "vp test run --passWithNoTests --project '!@repo/*' --exclude '**/*.dev-server.test.ts' $AFFECTED_PATHS",
      "vp run -r premerge",
      "vp run --filter @repo/e2e test:e2e",
      "vp run -r prepr",
    ]);
  });

  it("every workspace declares its tasks where the lifecycle finds them", () => {
    expect.hasAssertions();
    expect(pnpmWorkspaces["../../../../pnpm-workspace.yaml"]).toMatch(
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
    expect(dependencies(".", "prepush")).toContain("check:code");
    expect(reachable(".", ["prepush"])).toEqual(
      expect.arrayContaining([
        "check:code",
        "check:effect",
        "knip",
        "check:client",
        "check:imports",
        "check:react",
        "check:canonical-literal-types",
      ]),
    );
    expect(reachable(".", ["prepush"])).not.toContain("test");
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
    expect(commands(".", "test:dev-server")).toStrictEqual(["vp test run --project dev-server"]);
    expect(unmatchedProjectNames()).toStrictEqual([]);
  });

  it("keeps every tools package with tests on a vitest project or pull request gate", () => {
    expect.hasAssertions();
    expect(toolsPackagesWithTests().length).toBeGreaterThan(0);
    expect(uncoveredToolTestPackages()).toStrictEqual([]);
    expect(testProjectDirectories).toEqual(
      expect.arrayContaining(dedicatedToolVitestProjects.map((path) => path.replace(/^\.\//u, ""))),
    );
  });
});

describe("on-demand gate escapes", () => {
  it("keeps the on-demand allowlist frozen so new escapes need an explicit test change", () => {
    expect.hasAssertions();
    expect([...onDemandGateEntries].toSorted()).toStrictEqual([...frozenOnDemandGateEntries]);
  });
});

describe("mergify ci insights", () => {
  it("keeps MERGIFY_TOKEN on every check job and enables reduced merge-queue reruns", () => {
    expect.hasAssertions();
    const workflow = workflows["../../../../.github/workflows/check.yml"];
    if (workflow === undefined) {
      throw new Error("check.yml is missing");
    }
    expect(workflow).toMatch(
      /^ {2}check:\n(?: {4}.+\n)*? {4}env:\n {6}MERGIFY_TOKEN: \$\{\{ secrets\.MERGIFY_TOKEN \}\}$/mu,
    );
    expect(workflow).toMatch(
      /^ {2}merge-queue:\n(?: {4}.+\n)*? {4}env:\n {6}MERGIFY_TOKEN: \$\{\{ secrets\.MERGIFY_TOKEN \}\}\n {6}VITEST_MERGIFY_TEST_SELECTION_ENABLE: "true"$/mu,
    );
    expect(workflow).toMatch(
      /^ {2}e2e:\n(?: {4}.+\n)*? {4}env:\n {6}MERGIFY_TOKEN: \$\{\{ secrets\.MERGIFY_TOKEN \}\}\n {6}VITEST_MERGIFY_TEST_SELECTION_ENABLE: "true"$/mu,
    );
    expect(workflow).toMatch(
      /^ {2}cache:\n(?: {4}.+\n)*? {4}env:\n {6}MERGIFY_TOKEN: \$\{\{ secrets\.MERGIFY_TOKEN \}\}$/mu,
    );
    expect(workflow).not.toMatch(/^\s+- run: .+\n\s+env:\n\s+MERGIFY_TOKEN:/mu);
  });

  it("probes Mergify check-job product state with the Mergify CLI", () => {
    expect.hasAssertions();
    const workflow = workflows["../../../../.github/workflows/mergify-probe.yml"];
    if (workflow === undefined) {
      throw new Error("mergify-probe.yml is missing");
    }
    expect(workflow).toMatch(/Mergifyio\/setup-cli@/u);
    expect(workflow).toMatch(/mergify events/u);
    expect(workflow).toMatch(/mergify config simulate/u);
    expect(workflow).toMatch(/\/v1\/products\//u);
    expect(workflow).toMatch(/ci_insights/u);
    expect(workflow).toMatch(/MERGIFY_TOKEN: \$\{\{ secrets\.MERGIFY_TOKEN \}\}/u);
  });

  it("keeps merge-queue gates on the check jobs Mergify can see", () => {
    expect.hasAssertions();
    expect(mergifyConfig).toMatch(/check-success = check/u);
    expect(mergifyConfig).toMatch(/check-success = merge-queue/u);
    expect(mergifyConfig).toMatch(/check-success = e2e/u);
    expect(mergifyConfig).toMatch(/mode: isolated/u);
    expect(mergifyConfig).toMatch(/max_parallel_checks: 5/u);
    expect(mergifyConfig).toMatch(/checks_timeout: 45 min/u);
  });
});
