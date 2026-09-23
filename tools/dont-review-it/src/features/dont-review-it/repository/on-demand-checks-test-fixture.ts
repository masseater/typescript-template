import { rootOnDemandChecks } from "./on-demand-checks.ts";

const onDemandGateEntries = new Set([
  ...Object.keys(rootOnDemandChecks).map((name) => `.: ${name}`),
  "tools/dev: verify",
]);

const frozenOnDemandGateEntries = [
  ".: check:repository",
  ".: check:types",
  "tools/dev: verify",
] as const;

export { frozenOnDemandGateEntries, onDemandGateEntries };
