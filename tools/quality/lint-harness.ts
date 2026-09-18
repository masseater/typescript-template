import { RuleTester } from "vite-plus/lint/plugins-dev";

import plugin from "./rules.ts";

type RuleName =
  | "annotations"
  | "boundaries"
  | "cross-request-state"
  | "effect-failures"
  | "effect-stack"
  | "environment-boundary"
  | "example-values"
  | "git-environment"
  | "layers"
  | "no-internal-mocks"
  | "no-manual-memoization"
  | "test-import-graph"
  | "worker-fetch";

const ruleNames: readonly RuleName[] = [
  "annotations",
  "boundaries",
  "cross-request-state",
  "effect-failures",
  "effect-stack",
  "environment-boundary",
  "example-values",
  "git-environment",
  "layers",
  "no-internal-mocks",
  "no-manual-memoization",
  "test-import-graph",
  "worker-fetch",
];

function runImmediately(_text: string, run: () => void): void {
  run();
}

RuleTester.describe = runImmediately;
RuleTester.it = runImmediately;
const tester = new RuleTester({ cwd: "/project" });

const errorCountPattern = /^Should have no errors but had (?<count>\d+)/u;

function reportCount(name: RuleName, filename: string, code: string): number {
  const rule = plugin.rules[name];
  if (rule === undefined) {
    throw new Error(`Unknown rule ${name}`);
  }
  try {
    tester.run(name, rule, { invalid: [], valid: [{ code, filename }] });
    return 0;
  } catch (error) {
    const count =
      error instanceof Error ? errorCountPattern.exec(error.message)?.groups?.["count"] : undefined;
    if (count === undefined) {
      throw error;
    }
    return Number(count);
  }
}

function reported(name: RuleName, filename: string, code: string): boolean {
  return reportCount(name, filename, code) > 0;
}

function reportedRules(filename: string, code: string): RuleName[] {
  return ruleNames.filter((rule) => reported(rule, filename, code));
}

export { reportCount, reported, reportedRules, ruleNames };
