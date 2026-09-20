import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const toolsDirectory = fileURLToPath(new URL("..", import.meta.url));

const dedicatedToolVitestProjects = [
  "./tools/ai-native",
  "./tools/dont-review-it",
  "./tools/e2e",
  "./tools/lint-rule-authoring",
  "./tools/repository-checks",
  "./tools/stop-ai-slop",
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

export { dedicatedToolVitestProjects, rootNodeToolTestIncludes };
