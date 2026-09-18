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

function field(manifest: unknown, key: string): unknown {
  return typeof manifest === "object" && manifest !== null
    ? Object.getOwnPropertyDescriptor(manifest, key)?.value
    : undefined;
}

const manifestModules: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../{apps,libs,infra,tools}/*/package.json",
  { eager: true, import: "default" },
);

function repositoryPath(key: string): string {
  const resolved = ["tools", "quality"];
  for (const segment of key.split("/")) {
    if (segment === "..") {
      resolved.pop();
    } else if (segment !== ".") {
      resolved.push(segment);
    }
  }
  return resolved.join("/");
}

const workspaceManifests: readonly WorkspaceManifest[] = Object.entries(manifestModules).map(
  ([key, manifest]: readonly [string, unknown]) => {
    const file = repositoryPath(key);
    const [area = ""] = file.split("/");
    return { area, file, manifest };
  },
);

function applicationNames(workspaces: readonly WorkspaceManifest[]): string[] {
  return workspaces.flatMap(({ area, manifest }) => {
    const name = field(manifest, "name");
    return area === "apps" && typeof name === "string" ? [name] : [];
  });
}

function declaredDependencies(manifest: unknown): string[] {
  return dependencyFields.flatMap((key) => {
    const value = field(manifest, key);
    return typeof value === "object" && value !== null ? Object.keys(value) : [];
  });
}

function applicationDependencyViolations(workspaces: readonly WorkspaceManifest[]): string[] {
  const applications = applicationNames(workspaces);
  return workspaces.flatMap(({ file, manifest }) =>
    declaredDependencies(manifest)
      .filter((dependency) => applications.includes(dependency))
      .map(
        (dependency) =>
          `${file}: ${dependency} はデプロイ単位のアプリです。バッチやコンソールなど他の実行単位と共有する処理は libs/ のパッケージに移し、そちらに依存してください。`,
      ),
  );
}

function retiredDependencyViolations(workspaces: readonly WorkspaceManifest[]): string[] {
  return workspaces.flatMap(({ file, manifest }) =>
    declaredDependencies(manifest).flatMap((dependency) => {
      const replacement = replacementFor(dependency);
      return replacement === undefined
        ? []
        : [`${file}: ${dependency} は置き換え済みです。${replacementMessage(replacement)}`];
    }),
  );
}

const rootOnlyPackages: Readonly<Record<string, string>> = {
  "react-doctor": "ルートの vp run check",
};

function rootOnlyDependencyViolations(workspaces: readonly WorkspaceManifest[]): string[] {
  return workspaces.flatMap(({ file, manifest }) => {
    const declared = declaredDependencies(manifest);
    return Object.entries(rootOnlyPackages)
      .filter(([dependency]) => declared.includes(dependency))
      .map(
        ([dependency, runner]) =>
          `${file}: ${dependency} はリポジトリ全体の検査なのでルートだけが宣言します。${runner} から実行してください。`,
      );
  });
}

export {
  applicationDependencyViolations,
  field,
  retiredDependencyViolations,
  rootOnlyDependencyViolations,
  rootOnlyPackages,
  workspaceManifests,
};
export type { WorkspaceManifest };
