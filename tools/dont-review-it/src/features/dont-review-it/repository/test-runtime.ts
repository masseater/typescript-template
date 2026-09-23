const workerTestSuffix = ".worker.test.ts";
const workerTests = `**/*${workerTestSuffix}`;
const isolatedNodeTestSuffix = ".isolated.test.ts";
const isolatedNodeTests = `**/*${isolatedNodeTestSuffix}`;
const devServerTests = "**/*.dev-server.test.ts";
const workerTestPattern = String.raw`\.worker\.test\.[cm]?[jt]sx?$`;
const testPattern = String.raw`\.(?:test|spec)\.[cm]?[jt]sx?$`;
const unitTestShardCount = 4;
const prCheckShardCount = 4;
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
  /\/libs\/(?:ui|auth-ui)\/|\/libs\/runtime\/src\/features\/runtime\/client\.ts$|\/libs\/db\/src\/features\/db\/remote[^/]*\.ts$|\/libs\/db-local\/src\/features\/db-local\/testing-node[^/]*\.ts$/u;

const runsInWorkerRuntime = (inspected: string): boolean => {
  return (
    deployedToWorkers.test(inspected) &&
    !browserOrNodeOnly.test(inspected) &&
    (!testFile.test(inspected) || workerTestFile.test(inspected))
  );
};

export {
  devServerTests,
  isolatedNodeTestSuffix,
  isolatedNodeTests,
  nodeRuntimePackages,
  prCheckShardCount,
  runsInWorkerRuntime,
  testPattern,
  unitTestShardCount,
  workerRuntimeModules,
  workerTestPattern,
  workerTestSuffix,
  workerTests,
};
