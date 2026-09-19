const sandboxUnsafeTestPattern = "**/*.sandbox-unsafe.test.ts";

const sandboxUnsafeTests = [
  "tools/dont-review-it/src/repository/dependency-cruiser.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/repository/effect-diagnostics.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/repository/stryker-sandbox.sandbox-unsafe.test.ts",
] as const;

const sandboxUnsafeReasons = [
  "tsconfig.json",
  "isSymbolicLink",
  "readlink",
  "readlinkSync",
  "lstat",
  "lstatSync",
] as const;

export { sandboxUnsafeReasons, sandboxUnsafeTestPattern, sandboxUnsafeTests };
