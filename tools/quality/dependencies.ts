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

const workspaceManifests: readonly WorkspaceManifest[] = Object.entries(manifestModules).map(
  ([key, manifest]: readonly [string, unknown]) => {
    const file = key.replace(/^(?:\.\.\/)+/u, "");
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

const retiredPackages: Readonly<Record<string, string>> = {
  "@pulumi/": "alchemy",
  "@types/styled-components": "Tailwind CSS v4 のユーティリティ",
  pulumi: "alchemy",
  "react-intl": "Paraglide JS",
  "smarthr-ui": "@template/ui/ui の shadcn/ui (Base UI) 部品",
  "styled-components": "Tailwind CSS v4 のユーティリティ",
};

function replacementFor(dependency: string): string | undefined {
  const matched = Object.keys(retiredPackages).find(
    (retired) =>
      dependency === retired || (retired.endsWith("/") && dependency.startsWith(retired)),
  );
  return matched === undefined ? undefined : retiredPackages[matched];
}

function retiredDependencyViolations(workspaces: readonly WorkspaceManifest[]): string[] {
  return workspaces.flatMap(({ file, manifest }) =>
    declaredDependencies(manifest).flatMap((dependency) => {
      const replacement = replacementFor(dependency);
      return replacement === undefined
        ? []
        : [`${file}: ${dependency} は置き換え済みです。${replacement} を使ってください。`];
    }),
  );
}

export {
  applicationDependencyViolations,
  field,
  retiredDependencyViolations,
  retiredPackages,
  workspaceManifests,
};
export type { WorkspaceManifest };
