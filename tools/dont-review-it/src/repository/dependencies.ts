import { isRecord } from "../dependency-catalog/record-fields.ts";
import { repositoryRelative } from "./repository-path.ts";
import { replacementFor, replacementMessage } from "./retired-packages.ts";

interface WorkspaceManifest {
  readonly area: string;
  readonly file: string;
  readonly manifest: unknown;
}

const field = (declared: unknown, propertyName: string): unknown =>
  isRecord(declared) ? Object.getOwnPropertyDescriptor(declared, propertyName)?.value : undefined;

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const manifestModules: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/package.json",
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

const rootOnlyPackages: Readonly<
  Record<string, { readonly owners: readonly string[]; readonly runner: string }>
> = {};

const developmentOnlyPackages: Readonly<Record<string, string>> = {
  miniflare: "ローカル DB / Worker テストの実行環境",
  wrangler: "ローカル DB の構築とマイグレーション",
};

const developmentOnlyDependencyViolations = (
  workspaces: readonly WorkspaceManifest[],
): string[] => {
  return workspaces.flatMap(({ area, file, manifest }) => {
    if (area !== "apps" && area !== "libs") {
      return [];
    }
    if (file === "libs/db-local/package.json") {
      return [];
    }
    const dependencies = field(manifest, "dependencies");
    if (typeof dependencies !== "object" || dependencies === null) {
      return [];
    }
    return Object.keys(dependencies)
      .filter((dependency) => dependency in developmentOnlyPackages)
      .map(
        (dependency) =>
          `${file}: ${dependency} は ${developmentOnlyPackages[dependency]}用です。配布物側の dependencies に置かず、ローカル実行を所有するパッケージへ移してください。`,
      );
  });
};

const libraryMixedSurfaceViolations = (workspaces: readonly WorkspaceManifest[]): string[] => {
  return workspaces.flatMap(({ area, file, manifest }) => {
    if (area !== "libs") {
      return [];
    }
    if (file === "libs/db-local/package.json") {
      return [];
    }
    const bin = field(manifest, "bin");
    const exportsField = field(manifest, "exports");
    if (bin === undefined || exportsField === undefined) {
      return [];
    }
    const name = field(manifest, "name");
    return [
      `${file}: ${typeof name === "string" ? name : file} は取り込み面（exports）とコマンド面（bin）を同時に宣言しています。コマンド入口は tools/ 側の所有パッケージへ移してください。`,
    ];
  });
};

const rootOnlyDependencyViolations = (workspaces: readonly WorkspaceManifest[]): string[] => {
  return workspaces.flatMap(({ file, manifest }) => {
    const declared = declaredDependencies(manifest);
    return Object.entries(rootOnlyPackages)
      .filter(([dependency, { owners }]) => declared.includes(dependency) && !owners.includes(file))
      .map(
        ([dependency, { owners, runner }]) =>
          `${file}: ${dependency} はリポジトリ全体の検査なので ${owners.join(" / ")} だけが宣言します。${runner} から実行してください。`,
      );
  });
};

export {
  applicationDependencyViolations,
  declaredDependencies,
  developmentOnlyDependencyViolations,
  field,
  libraryMixedSurfaceViolations,
  retiredDependencyViolations,
  rootOnlyDependencyViolations,
  rootOnlyPackages,
  workspaceManifests,
};
export type { WorkspaceManifest };
