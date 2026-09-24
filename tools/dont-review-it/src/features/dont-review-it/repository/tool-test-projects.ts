// @effect-diagnostics-next-line nodeBuiltinImport:off
import { readdirSync } from "node:fs";

import { filePathOf } from "../platform/path.ts";

const toolsDirectory = filePathOf(new URL("../../../../..", import.meta.url));

const dedicatedToolVitestProjects = [
  "./tools/ai-native",
  "./tools/ai-native-telemetry",
  "./tools/dont-review-it",
  "./tools/e2e",
] as const;

const dedicatedToolNames = new Set(
  dedicatedToolVitestProjects.map((path) => path.replace(/^\.\/tools\//u, "")),
);

const rootNodeToolTestIncludes: readonly string[] = readdirSync(toolsDirectory, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && !dedicatedToolNames.has(entry.name))
  .map((entry) => entry.name)
  .toSorted((left, right) => left.localeCompare(right))
  .flatMap((name) => [`tools/${name}/**/*.test.ts`, `tools/${name}/**/*.test.tsx`]);

const rootNodeTestIncludes = [
  "libs/**/*.test.ts",
  "libs/**/*.test.tsx",
  "apps/**/*.test.ts",
  "apps/**/*.test.tsx",
  ...rootNodeToolTestIncludes,
  "tools/dont-review-it/src/features/dont-review-it/repository/**/*.test.ts",
  "infra/**/*.test.ts",
] as const;

export { dedicatedToolVitestProjects, rootNodeTestIncludes };
