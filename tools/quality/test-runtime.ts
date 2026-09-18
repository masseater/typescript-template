const workerTestSuffix = ".worker.test.ts";
const workerTests = `**/*${workerTestSuffix}`;
const workerTestFile = /\.worker\.test\.[cm]?[jt]sx?$/u;
const testFile = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
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
  workerRuntimeModules,
  workerTestSuffix,
  workerTests,
};
