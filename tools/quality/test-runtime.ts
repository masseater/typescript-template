const workerTestSuffix = ".worker.test.ts";
const workerTests = `**/*${workerTestSuffix}`;
const workerTestPattern = String.raw`\.worker\.test\.[cm]?[jt]sx?$`;
const testPattern = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
const workerTestFile = new RegExp(workerTestPattern, "u");
const testFile = new RegExp(testPattern, "u");
const deployedToWorkers = /\/(?:apps|libs|infra\/(?:budget|error|health)-monitor)\//u;
const browserOrNodeOnly =
  /\/libs\/ui\/|\/libs\/observability\/src\/browser\.ts$|\/libs\/runtime\/src\/client\.ts$|\/libs\/db\/src\/(?:remote|testing-node)[^/]*\.ts$/u;
const nodeRuntimePackages = [
  "msw/node",
  "miniflare",
  "wrangler",
  "drizzle-kit",
  "@effect/platform-node",
] as const;
const workerRuntimeModules = ["cloudflare:test", "cloudflare:workers"] as const;

function runsInWorkerRuntime(current: string): boolean {
  return (
    deployedToWorkers.test(current) &&
    !browserOrNodeOnly.test(current) &&
    (!testFile.test(current) || workerTestFile.test(current))
  );
}

export {
  nodeRuntimePackages,
  runsInWorkerRuntime,
  testPattern,
  workerRuntimeModules,
  workerTestPattern,
  workerTestSuffix,
  workerTests,
};
