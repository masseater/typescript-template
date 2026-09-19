const rootOnDemandChecks = {
  "check:repository": ["dont-review-it check", "lint-rule-authoring check", "stop-ai-slop check"],
};

const onDemandGateEntries = new Set([
  ...Object.keys(rootOnDemandChecks).map((name) => `.: ${name}`),
  "tools/observe: verify",
  "tools/observe: check:exported",
]);

export { onDemandGateEntries, rootOnDemandChecks };
