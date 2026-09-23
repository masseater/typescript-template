import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const workspaceGroups = ["apps", "libs", "infra", "tools"] as const;

const typecheckProjects = (root: string): readonly string[] => {
  const nested = workspaceGroups.flatMap((group) =>
    readdirSync(path.join(root, group), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? [path.join(group, entry.name, "tsconfig.json")] : [],
    ),
  );
  return ["tsconfig.json", ...nested]
    .filter((project) => existsSync(path.join(root, project)))
    .toSorted();
};

export { typecheckProjects };
