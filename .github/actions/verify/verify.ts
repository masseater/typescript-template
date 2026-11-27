import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EXIT_FAILURE, env, field, optionalEnv, run } from "../shared/runner.ts";

const SUCCESS = 0;
const NONE = 0;
const SINGLE = 1;
const DECIMAL = 10;
const HALF = 2;
const SEPARATOR = "#";
const VERIFY = "verify";

interface PlannedTask {
  readonly dependsOn: readonly string[];
  readonly durationMs: number;
}

type Plan = Readonly<Record<string, PlannedTask>>;

type Durations = Readonly<Record<string, number>>;

interface Split {
  readonly plan: Plan;
  readonly durations: Durations;
  readonly count: number;
}

const passes = (args: readonly string[]): boolean =>
  spawnSync("vp", ["run", "--log", "grouped", ...args], { stdio: "inherit" }).status === SUCCESS;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const total = (values: readonly number[]): number => {
  let sum = NONE;
  for (const value of values) {
    sum += value;
  }
  return sum;
};

const strings = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
};

const numbers = (value: unknown): Durations => {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[SINGLE] === "number",
    ),
  );
};

const baselineOf = (step: unknown): number => {
  if (!isRecord(step) || !isRecord(step["cache"])) {
    return NONE;
  }
  const { baseline } = step["cache"];
  if (!isRecord(baseline) || typeof baseline["durationMs"] !== "number") {
    return NONE;
  }
  return baseline["durationMs"];
};

const plannedTaskOf = (task: unknown): PlannedTask => {
  if (!isRecord(task)) {
    return { dependsOn: [], durationMs: NONE };
  }
  const { steps, dependsOn } = task;
  if (!Array.isArray(steps)) {
    return { dependsOn: strings(dependsOn), durationMs: NONE };
  }
  return {
    dependsOn: strings(dependsOn),
    durationMs: total(steps.map((step) => baselineOf(step))),
  };
};

const readPlan = (): Plan => {
  const plan = field(JSON.parse(run("vp", ["run", "--dry-run", "--json", VERIFY])), "plan");
  if (!isRecord(plan)) {
    return {};
  }
  return Object.fromEntries(Object.entries(plan).map(([id, task]) => [id, plannedTaskOf(task)]));
};

const dependenciesOf = (plan: Plan, id: string): readonly string[] => {
  const task = plan[id];
  if (task === undefined) {
    return [];
  }
  return task.dependsOn;
};

const closureOf = (plan: Plan, root: string): ReadonlySet<string> => {
  const seen = new Set<string>();
  const pending = [root];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (!seen.has(id)) {
      seen.add(id);
      pending.push(...dependenciesOf(plan, id));
    }
  }
  return seen;
};

const packageOf = (id: string): string => id.slice(NONE, id.lastIndexOf(SEPARATOR));

const taskOf = (id: string): string => id.slice(id.lastIndexOf(SEPARATOR) + SINGLE);

const selectorOf = (id: string): readonly string[] => {
  if (!id.includes(SEPARATOR)) {
    return ["-w", id];
  }
  return ["--filter", `{./${packageOf(id)}}`, taskOf(id)];
};

const readDurations = (file: string): Durations => {
  if (!existsSync(file)) {
    return {};
  }
  return numbers(JSON.parse(readFileSync(file, "utf8")));
};

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.floor(sorted.length / HALF)] ?? SINGLE;
};

const rootsOf = (plan: Plan): readonly string[] => dependenciesOf(plan, VERIFY);

const weigher = (durations: Durations): ((task: string) => number) => {
  const fallback = median(Object.values(durations));
  return (task) => durations[task] ?? fallback;
};

const heaviestFirst = (plan: Plan, weightOf: (task: string) => number): readonly string[] =>
  rootsOf(plan)
    .map((root) => ({
      root,
      weight: total([...closureOf(plan, root)].map((task) => weightOf(task))),
    }))
    .toSorted(
      (left, right) => right.weight - left.weight || left.root.localeCompare(right.root, "en"),
    )
    .map(({ root }) => root);

const partition = ({ plan, durations, count }: Split): readonly (readonly string[])[] => {
  const weightOf = weigher(durations);
  const shards = Array.from({ length: count }, () => ({
    roots: new Array<string>(),
    tasks: new Set<string>(),
    load: NONE,
  }));
  const place = (root: string): void => {
    const [lightest] = shards.toSorted((left, right) => left.load - right.load);
    if (lightest === undefined) {
      return;
    }
    lightest.roots.push(root);
    for (const task of closureOf(plan, root)) {
      if (!lightest.tasks.has(task)) {
        lightest.tasks.add(task);
        lightest.load += weightOf(task);
      }
    }
  };
  for (const root of heaviestFirst(plan, weightOf)) {
    place(root);
  }
  return shards.map((shard) => shard.roots.toSorted());
};

const argsOf = (task: string, members: readonly string[]): readonly string[] => [
  ...members.flatMap((member) => ["--filter", `{./${packageOf(member)}}`]),
  task,
];

const groupRun = (roots: readonly string[]): readonly (readonly string[])[] => {
  const inPackages = Map.groupBy(
    roots.filter((root) => root.includes(SEPARATOR)),
    taskOf,
  );
  const atRoot = roots.filter((root) => !root.includes(SEPARATOR)).map((root) => ["-w", root]);
  const filtered = [...inPackages].map(([task, members]) => argsOf(task, members));
  return [...filtered, ...atRoot];
};

const runAll = (roots: readonly string[]): boolean => {
  const results = groupRun(roots).map((args) => passes(args));
  if (results.every(Boolean)) {
    return true;
  }
  const failed = roots.filter((root) => !passes(selectorOf(root)));
  console.error(
    `verify failed. Tasks that still fail when each runs on its own: ${failed.join(", ")}`,
  );
  return false;
};

const durationOf = (plan: Plan, task: string): number => {
  const planned = plan[task];
  if (planned === undefined) {
    return NONE;
  }
  return planned.durationMs;
};

const measured = (roots: readonly string[]): Durations => {
  const after = readPlan();
  const tasks = new Set(roots.flatMap((root) => [...closureOf(after, root)]));
  return Object.fromEntries([...tasks].map((task) => [task, durationOf(after, task)]));
};

interface ShardRun {
  readonly index: number;
  readonly assignment: readonly (readonly string[])[];
}

const report = ({ index, assignment }: ShardRun): void => {
  const file = env("VERIFY_SHARD_REPORT");
  const hash = createHash("sha256").update(JSON.stringify(assignment)).digest("hex");
  const durations = measured(assignment[index] ?? []);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({ shard: index, shards: assignment.length, assignment: hash, durations }),
  );
};

const verifyShard = (index: number, count: number): boolean => {
  const durations = readDurations(env("VERIFY_DURATIONS"));
  const assignment = partition({ plan: readPlan(), durations, count });
  const roots = assignment[index] ?? [];
  console.log(`shard ${String(index)} of ${String(count)} runs ${roots.join(", ")}`);
  const passed = runAll(roots);
  report({ index, assignment });
  return passed;
};

const verifyWhole = (): boolean => passes([VERIFY]) || runAll(rootsOf(readPlan()));

const verify = (count: number): boolean => {
  if (count > SINGLE) {
    return verifyShard(Number.parseInt(env("VERIFY_SHARD"), DECIMAL), count);
  }
  return verifyWhole();
};

const passed = verify(Number.parseInt(optionalEnv("VERIFY_SHARDS") ?? String(SINGLE), DECIMAL));
if (!passed) {
  process.exitCode = EXIT_FAILURE;
}
