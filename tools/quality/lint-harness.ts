import { RuleTester } from "vite-plus/lint/plugins-dev";

import plugin from "./plugin.ts";

const ruleNames = [
  "annotations",
  "boundaries",
  "cross-request-state",
  "effect-failures",
  "effect-stack",
  "environment-boundary",
  "example-values",
  "git-environment",
  "layers",
  "logs",
  "no-internal-mocks",
  "no-manual-memoization",
  "process-boundary",
  "retired-imports",
  "span-mutation",
  "test-import-graph",
  "worker-fetch",
] as const;

type RuleName = (typeof ruleNames)[number];

const runImmediately = (_title: string, run: () => void): void => {
  run();
};

RuleTester.describe = runImmediately;
RuleTester.it = runImmediately;
const tester = new RuleTester({ cwd: "/project" });

const errorCountPattern = /^Should have no errors but had (?<count>\d+)/u;

const reportCount = (
  ruleName: RuleName,
  probe: { readonly code: string; readonly filename: string },
): number => {
  const rule = plugin.rules[ruleName];
  if (rule === undefined) {
    throw new Error(`Unknown rule ${ruleName}`);
  }
  try {
    tester.run(ruleName, rule, { invalid: [], valid: [probe] });
    return 0;
  } catch (caught) {
    const reportedCount =
      caught instanceof Error ? errorCountPattern.exec(caught.message)?.groups?.count : undefined;
    if (reportedCount === undefined) {
      throw caught;
    }
    return Number(reportedCount);
  }
};

const reported = (
  ruleName: RuleName,
  probe: { readonly code: string; readonly filename: string },
): boolean => {
  return reportCount(ruleName, probe) > 0;
};

const reportedRules = (probe: { readonly code: string; readonly filename: string }): RuleName[] => {
  return ruleNames.filter((ruleName) => reported(ruleName, probe));
};

export { reportCount, reported, reportedRules, ruleNames };
