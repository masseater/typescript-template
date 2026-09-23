type WorkspacePackage = Readonly<{
  dependencies: readonly string[];
  directory: string;
  name: string;
}>;

type AffectedTests =
  | { readonly kind: "all" }
  | { readonly directories: readonly string[]; readonly kind: "subset" };

const workspaceDirectory = /^(?<directory>(?:apps|libs|infra|tools)\/[^/]+)\//u;

const packageOf = (
  file: string,
  packages: readonly WorkspacePackage[],
): WorkspacePackage | undefined => {
  const directory = workspaceDirectory.exec(file)?.groups?.["directory"];
  if (directory === undefined) {
    return undefined;
  }
  return packages.find((workspace) => workspace.directory === directory);
};

const withDependents = (
  selected: ReadonlySet<string>,
  packages: readonly WorkspacePackage[],
): readonly string[] => {
  const seen = new Set(selected);
  const pending = [...selected];
  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined) {
      break;
    }
    for (const workspace of packages) {
      if (workspace.dependencies.includes(name) && !seen.has(workspace.name)) {
        seen.add(workspace.name);
        pending.push(workspace.name);
      }
    }
  }
  return packages
    .filter((workspace) => seen.has(workspace.name))
    .map((workspace) => workspace.directory)
    .toSorted();
};

const affectedTests = (
  files: readonly string[],
  packages: readonly WorkspacePackage[],
): AffectedTests => {
  if (files.length === 0) {
    return { kind: "all" };
  }
  const selected = new Set<string>();
  for (const file of files) {
    const workspace = packageOf(file, packages);
    if (workspace === undefined) {
      return { kind: "all" };
    }
    selected.add(workspace.name);
  }
  return { directories: withDependents(selected, packages), kind: "subset" };
};

export { affectedTests };
export type { WorkspacePackage };
