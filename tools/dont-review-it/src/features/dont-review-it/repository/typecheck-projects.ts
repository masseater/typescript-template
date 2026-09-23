import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const workspaceGroups = ["apps", "libs", "infra", "tools"] as const;

const skippedDirectoryNames = new Set([
  ".git",
  ".local",
  ".paraglide",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);

const tsconfigFilesUnder = (root: string, directory: string): readonly string[] => {
  const entries = readdirSync(path.join(root, directory), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return skippedDirectoryNames.has(entry.name) ? [] : tsconfigFilesUnder(root, relative);
    }
    return entry.isFile() && entry.name === "tsconfig.json"
      ? [relative.split(path.sep).join("/")]
      : [];
  });
};

const typecheckProjects = (root: string): readonly string[] => {
  const nested = workspaceGroups.flatMap((group) =>
    existsSync(path.join(root, group)) ? tsconfigFilesUnder(root, group) : [],
  );
  return ["tsconfig.json", ...nested]
    .filter((project) => existsSync(path.join(root, project)))
    .toSorted();
};

export { typecheckProjects };
