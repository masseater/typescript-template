const rootOnDemandChecks = {
  "check:repository": ["dont-review-it check", "lint-rule-authoring check", "stop-ai-slop check"],
};

const onDemandGateEntries = new Set([
  ...Object.keys(rootOnDemandChecks).map((name) => `.: ${name}`),
  "tools/observe: verify",
  "tools/observe: check:exported",
]);

const frozenOnDemandGateEntries = [
  ".: check:repository",
  "tools/observe: check:exported",
  "tools/observe: verify",
] as const;

export { frozenOnDemandGateEntries, onDemandGateEntries, rootOnDemandChecks };
