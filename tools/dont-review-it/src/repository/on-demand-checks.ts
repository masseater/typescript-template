const rootOnDemandChecks = {
  "check:repository": "dont-review-it check-repository",
};

const onDemandGateEntries = new Set([
  ...Object.keys(rootOnDemandChecks).map((name) => `.: ${name}`),
  "tools/dev: verify",
  "tools/dev: check:exported",
]);

const frozenOnDemandGateEntries = [
  ".: check:repository",
  "tools/dev: check:exported",
  "tools/dev: verify",
] as const;

export { frozenOnDemandGateEntries, onDemandGateEntries, rootOnDemandChecks };
