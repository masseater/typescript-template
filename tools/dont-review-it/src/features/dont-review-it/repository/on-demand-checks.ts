const rootOnDemandChecks = {
  "check:repository": "dont-review-it check-repository",
  "check:types": "dont-review-it-typecheck",
};

const onDemandGateEntries = new Set([
  ...Object.keys(rootOnDemandChecks).map((name) => `.: ${name}`),
  "tools/dev: verify",
]);

const frozenOnDemandGateEntries = [
  ".: check:repository",
  ".: check:types",
  "tools/dev: verify",
] as const;

export { frozenOnDemandGateEntries, onDemandGateEntries, rootOnDemandChecks };
