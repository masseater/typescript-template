import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "./rules.ts";

type RuleName =
  | "boundaries"
  | "environment-boundary"
  | "no-internal-mocks"
  | "test-import-graph"
  | "worker-fetch";

const ruleNames: readonly RuleName[] = [
  "boundaries",
  "environment-boundary",
  "no-internal-mocks",
  "test-import-graph",
  "worker-fetch",
];

function runImmediately(_text: string, run: () => void): void {
  run();
}

RuleTester.describe = runImmediately;
RuleTester.it = runImmediately;
const tester = new RuleTester({ cwd: "/project" });

function reported(name: RuleName, filename: string, code: string): boolean {
  const rule = plugin.rules[name];
  if (rule === undefined) {
    throw new Error(`Unknown rule ${name}`);
  }
  try {
    tester.run(name, rule, { invalid: [], valid: [{ code, filename }] });
    return false;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Should have no errors but had")) {
      return true;
    }
    throw error;
  }
}

function reportedRules(filename: string, code: string): RuleName[] {
  return ruleNames.filter((rule) => reported(rule, filename, code));
}

export { reported, reportedRules, ruleNames };
