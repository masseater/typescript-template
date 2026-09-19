import { AssertionError } from "node:assert";

import { RuleTester } from "vite-plus/lint/plugins-dev";

import plugin from "./plugin.ts";

type RuleName = keyof typeof plugin.rules;

const ruleNames = Object.keys(plugin.rules).toSorted() as RuleName[];

const runImmediately = (_title: string, run: () => void): void => {
  run();
};

RuleTester.describe = runImmediately;
RuleTester.it = runImmediately;
const tester = new RuleTester({ cwd: "/project" });

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
    if (caught instanceof AssertionError && typeof caught.actual === "number") {
      return caught.actual;
    }
    throw caught;
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
