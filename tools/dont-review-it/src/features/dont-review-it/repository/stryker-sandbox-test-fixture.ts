const sandboxUnsafeTests = [
  "tools/dont-review-it/src/features/dont-review-it/repository/dependency-cruiser.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository/effect-diagnostics.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository/inspection-gaps.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository/published-entries.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository/react-doctor.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository/single-consumer.sandbox-unsafe.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository/stryker-sandbox.sandbox-unsafe.test.ts",
] as const;

const sandboxUnsafeReasons = [
  "tsconfig.json",
  "isSymbolicLink",
  "readlink",
  "readlinkSync",
  "readLink",
  "lstat",
  "lstatSync",
  "symlink",
  "symlinkSync",
  "SymbolicLink",
  '"pack"',
] as const;

export { sandboxUnsafeReasons, sandboxUnsafeTests };
