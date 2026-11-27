import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EXIT_FAILURE, env } from "../shared/runner.ts";

const SINGLE = 1;
const VALUE = 1;
const NONE = 0;

interface Report {
  readonly shard: number;
  readonly shards: number;
  readonly assignment: string;
  readonly durations: Readonly<Record<string, number>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const numbers = (value: unknown): Readonly<Record<string, number>> => {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[VALUE] === "number",
    ),
  );
};

const reportOf = (file: string): readonly Report[] => {
  if (!existsSync(file)) {
    return [];
  }
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isRecord(parsed)) {
    return [];
  }
  const { shard, shards, assignment, durations } = parsed;
  if (typeof shard !== "number" || typeof shards !== "number" || typeof assignment !== "string") {
    return [];
  }
  return [{ shard, shards, assignment, durations: numbers(durations) }];
};

const reportsIn = (directory: string): readonly Report[] => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((name) =>
    reportOf(path.join(directory, name, "report.json")),
  );
};

const resultProblems = (result: string): readonly string[] => {
  if (result === "success") {
    return [];
  }
  return [`the shard jobs ended with ${result}`];
};

const countProblems = (reports: readonly Report[]): readonly string[] => {
  const counts = new Set(reports.map((report) => report.shards));
  const [count = NONE] = counts;
  if (reports.length > NONE && counts.size === SINGLE && reports.length === count) {
    return [];
  }
  return [`${String(reports.length)} reports came from shards of counts ${[...counts].join(", ")}`];
};

const missingProblems = (reports: readonly Report[]): readonly string[] => {
  const [count = NONE] = reports.map((report) => report.shards);
  const seen = new Set(reports.map((report) => report.shard));
  const missing = Array.from({ length: count }, (_slot, index) => index).filter(
    (index) => !seen.has(index),
  );
  if (missing.length === NONE) {
    return [];
  }
  return [`no report from shards ${missing.join(", ")}`];
};

const assignmentProblems = (reports: readonly Report[]): readonly string[] => {
  if (new Set(reports.map((report) => report.assignment)).size <= SINGLE) {
    return [];
  }
  return ["the shards split the tasks in different ways"];
};

const reports = reportsIn(env("VERIFY_REPORTS"));
const target = env("VERIFY_DURATIONS");
const merged = Object.fromEntries(reports.flatMap((report) => Object.entries(report.durations)));
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(merged));

const problems = [
  ...resultProblems(env("VERIFY_RESULT")),
  ...countProblems(reports),
  ...missingProblems(reports),
  ...assignmentProblems(reports),
];
for (const problem of problems) {
  console.error(`verify failed: ${problem}`);
}
if (problems.length > NONE) {
  process.exitCode = EXIT_FAILURE;
}
