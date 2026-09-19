import { field } from "@repo/dont-review-it/record-fields";

import { repositoryRelative } from "./repository-path.ts";
import { replacementFor, replacementMessage } from "./retired-packages.ts";

interface WorkspaceManifest {
  readonly area: string;
  readonly file: string;
  readonly manifest: unknown;
}

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const manifestModules: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../{apps,libs,infra,tools}/*/package.json",
  { eager: true, import: "default" },
);

const workspaceManifests: readonly WorkspaceManifest[] = Object.entries(manifestModules).map(
  ([key, manifest]: readonly [string, unknown]) => {
    const file = repositoryRelative(key);
    const [area = ""] = file.split("/");
    return { area, file, manifest };
  },
);

const applicationNames = (workspaces: readonly WorkspaceManifest[]): string[] => {
  return workspaces.flatMap(({ area, manifest }) => {
    const name = field(manifest, "name");
    return area === "apps" && typeof name === "string" ? [name] : [];
  });
};

const declaredDependencies = (manifest: unknown): string[] => {
  return dependencyFields.flatMap((key) => {
    const value = field(manifest, key);
    return typeof value === "object" && value !== null ? Object.keys(value) : [];
  });
};

const applicationDependencyViolations = (workspaces: readonly WorkspaceManifest[]): string[] => {
  const applications = applicationNames(workspaces);
  return workspaces.flatMap(({ file, manifest }) =>
    declaredDependencies(manifest)
      .filter((dependency) => applications.includes(dependency))
      .map(
        (dependency) =>
          `${file}: ${dependency} はデプロイ単位のアプリです。バッチやコンソールなど他の実行単位と共有する処理は libs/ のパッケージに移し、そちらに依存してください。`,
      ),
  );
};

const retiredDependencyViolations = (workspaces: readonly WorkspaceManifest[]): string[] => {
  return workspaces.flatMap(({ file, manifest }) =>
    declaredDependencies(manifest).flatMap((dependency) => {
      const replacement = replacementFor(dependency);
      return replacement === undefined
        ? []
        : [`${file}: ${dependency} は置き換え済みです。${replacementMessage(replacement)}`];
    }),
  );
};

const rootOnlyPackages: Readonly<Record<string, string>> = {
  "react-doctor": "ルートの vp run check:react",
};

const rootOnlyDependencyViolations = (workspaces: readonly WorkspaceManifest[]): string[] => {
  return workspaces.flatMap(({ file, manifest }) => {
    const declared = declaredDependencies(manifest);
    return Object.entries(rootOnlyPackages)
      .filter(([dependency]) => declared.includes(dependency))
      .map(
        ([dependency, runner]) =>
          `${file}: ${dependency} はリポジトリ全体の検査なのでルートだけが宣言します。${runner} から実行してください。`,
      );
  });
};

export {
  applicationDependencyViolations,
  declaredDependencies,
  field,
  retiredDependencyViolations,
  rootOnlyDependencyViolations,
  rootOnlyPackages,
  workspaceManifests,
};
export type { WorkspaceManifest };
