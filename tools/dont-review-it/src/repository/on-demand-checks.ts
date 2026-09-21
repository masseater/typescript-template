const rootOnDemandChecks = {
  "check:repository": "dont-review-it check-repository",
};

const onDemandGateEntries = new Set([
  ...Object.keys(rootOnDemandChecks).map((name) => `.: ${name}`),
  "tools/dev: verify",
  "tools/e2e: verify",
]);

const frozenOnDemandGateEntries = [
  ".: check:repository",
  "tools/dev: verify",
  "tools/e2e: verify",
] as const;

export { frozenOnDemandGateEntries, onDemandGateEntries, rootOnDemandChecks };
