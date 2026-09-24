import { architectureKindOf, modularBudgets } from "@repo/config";

const workspacePathOf = (cwd: string): string | undefined =>
  ["apps", "libs", "tools", "infra"]
    .map((area) => {
      const index = cwd.lastIndexOf(`/${area}/`);
      if (index < 0) {
        return undefined;
      }
      const [root, name] = cwd.slice(index + 1).split("/");
      return root !== undefined && name !== undefined ? `${root}/${name}` : undefined;
    })
    .find((value) => value !== undefined);

const isModularWorkspace = (cwd: string): boolean => {
  const workspacePath = workspacePathOf(cwd);
  return workspacePath !== undefined && architectureKindOf(workspacePath) === "modular";
};

const isPublicApiIndex = (fileName: string): boolean =>
  /^index(?:-test-fixture)?\.[cm]?[jt]sx?$/u.test(fileName);

const layerBudgetFindings = (lines: {
  readonly app: number;
  readonly shared: number;
}): readonly string[] => [
  ...(lines.app > modularBudgets.app
    ? [
        `app: ${lines.app} lines exceeds ${modularBudgets.app}. Move composition out into features/<name>.`,
      ]
    : []),
  ...(lines.shared > modularBudgets.shared
    ? [
        `shared: ${lines.shared} lines exceeds ${modularBudgets.shared}. Extract a features/<name> slice.`,
      ]
    : []),
];

const featureFindings = (
  features: readonly {
    readonly name: string;
    readonly directory: boolean;
    readonly publicApi: boolean;
  }[],
): readonly string[] =>
  features.flatMap((feature) => {
    if (!feature.directory) {
      return [`features/${feature.name}: place slice code in a directory, not a loose file.`];
    }
    if (!feature.publicApi) {
      return [
        `features/${feature.name}: missing public API index (features/${feature.name}/index.ts).`,
      ];
    }
    return [];
  });

export { featureFindings, isModularWorkspace, isPublicApiIndex, layerBudgetFindings };
