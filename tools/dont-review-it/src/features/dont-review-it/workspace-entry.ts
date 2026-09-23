export { dontReviewItPreset } from "./configs/preset.ts";
export { generatedFiles, lintOptions } from "./repository/lint.ts";
export {
  devServerTests,
  isolatedNodeTests,
  unitTestShardCount,
  workerTests,
} from "./repository/test-runtime.ts";
export { standardIoTest } from "./vitest/standard-io-test.ts";
export type { CapturedStream } from "./vitest/standard-io-test.ts";
export { rootOnDemandChecks } from "./repository/on-demand-checks.ts";
export {
  dedicatedToolVitestProjects,
  rootNodeToolTestIncludes,
} from "./repository/tool-test-projects.ts";
