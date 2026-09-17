import { providers, state } from "alchemy/Cloudflare";
import type { Application } from "@template/config";

const application = ["database"] as const;
const stackDependencies = {
  admin: application,
  "budget-monitor": ["tokens"],
  database: [],
  "error-monitor": ["tokens"],
  "health-monitor": [],
  tokens: [],
  user: application,
  wiki: application,
} as const satisfies Readonly<Record<string, readonly string[]>> &
  Readonly<Record<Application, typeof application>>;

type StackName = keyof typeof stackDependencies;

const stackNames = [
  "database",
  "tokens",
  "budget-monitor",
  "error-monitor",
  "health-monitor",
  "user",
  "admin",
  "wiki",
] as const satisfies readonly StackName[];

function stackName(stack: StackName): string {
  return `template-${stack}`;
}

const stackOptions = { providers: providers(), state: state() };

export { stackDependencies, stackName, stackNames, stackOptions };
export type { StackName };
