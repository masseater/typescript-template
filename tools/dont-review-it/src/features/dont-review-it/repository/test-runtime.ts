const workerTestSuffix = ".worker.test.ts";
const workerTests = `**/*${workerTestSuffix}`;
const devServerTests = "**/*.dev-server.test.ts";
const workerTestPattern = String.raw`\.worker\.test\.[cm]?[jt]sx?$`;
const testPattern = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
const nodeRuntimePackages = [
  "msw/node",
  "miniflare",
  "wrangler",
  "drizzle-kit",
  "@effect/platform-node",
] as const;
const workerRuntimeModules = ["cloudflare:test", "cloudflare:workers"] as const;

const workerTestFile = new RegExp(workerTestPattern, "u");

const testFile = new RegExp(testPattern, "u");

const deployedToWorkers = /\/(?:apps|libs|infra\/(?:budget|error|health)-monitor)\//u;

const browserOrNodeOnly =
  /\/libs\/(?:ui|auth-ui)\/|\/libs\/observability\/src\/browser\.ts$|\/libs\/runtime\/src\/client\.ts$|\/libs\/db\/src\/remote[^/]*\.ts$|\/libs\/db-local\/src\/testing-node[^/]*\.ts$/u;

const runsInWorkerRuntime = (inspected: string): boolean => {
  return (
    deployedToWorkers.test(inspected) &&
    !browserOrNodeOnly.test(inspected) &&
    (!testFile.test(inspected) || workerTestFile.test(inspected))
  );
};

export {
  devServerTests,
  nodeRuntimePackages,
  runsInWorkerRuntime,
  testPattern,
  workerRuntimeModules,
  workerTestPattern,
  workerTestSuffix,
  workerTests,
};
