type WorkspaceManifest = { area: string; file: string; manifest: unknown };

export const workspaceManifests: WorkspaceManifest[] = Object.entries(
  import.meta.glob<unknown>("../../{apps,libs,infra,tools}/*/package.json", {
    eager: true,
    import: "default",
  }),
).map(([key, manifest]) => {
  const file = key.replace(/^(?:\.\.\/)+/, "");
  return { area: file.split("/")[0] ?? "", file, manifest };
});

export function field(manifest: unknown, key: string): unknown {
  return typeof manifest === "object" && manifest !== null
    ? Object.getOwnPropertyDescriptor(manifest, key)?.value
    : undefined;
}

export function applicationDependencyViolations(
  workspaces: readonly WorkspaceManifest[],
): string[] {
  const applications = workspaces.flatMap(({ area, manifest }) => {
    const name = field(manifest, "name");
    return area === "apps" && typeof name === "string" ? [name] : [];
  });
  return workspaces.flatMap(({ file, manifest }) =>
    ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap(
      (key) => {
        const value = field(manifest, key);
        if (typeof value !== "object" || value === null) return [];
        return Object.keys(value)
          .filter((dependency) => applications.includes(dependency))
          .map(
            (dependency) =>
              `${file}: ${dependency} はデプロイ単位のアプリです。バッチやコンソールなど他の実行単位と共有する処理は libs/ のパッケージに移し、そちらに依存してください。`,
          );
      },
    ),
  );
}
