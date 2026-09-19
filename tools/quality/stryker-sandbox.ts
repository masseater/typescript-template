const sandboxUnsafeTestPattern = "**/*.sandbox-unsafe.test.ts";

const sandboxUnsafeTests = [
  "tools/quality/dependency-cruiser.sandbox-unsafe.test.ts",
  "tools/quality/effect-diagnostics.sandbox-unsafe.test.ts",
  "tools/quality/stryker-sandbox.sandbox-unsafe.test.ts",
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
