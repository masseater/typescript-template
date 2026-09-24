const workspaceRoots = ["apps", "libs", "infra", "tools"] as const;

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export { dependencyFields, workspaceRoots };
