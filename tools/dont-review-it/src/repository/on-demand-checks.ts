const rootOnDemandChecks = {
  "check:repository": "dont-review-it check-repository",
};

const onDemandGateEntries = new Set([
  ...Object.keys(rootOnDemandChecks).map((name) => `.: ${name}`),
  "tools/observe: verify",
  "tools/observe: check:exported",
]);

export { onDemandGateEntries, rootOnDemandChecks };
