import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type WorkspaceManifest = { area: string; file: string; manifest: unknown };

export async function readWorkspaceManifests(root: string): Promise<WorkspaceManifest[]> {
  const found = await Promise.all(
    ["apps", "libs", "infra", "tools"].map(async (area) => {
      const entries = await readdir(path.join(root, area), { withFileTypes: true });
      return Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const file = path.join(area, entry.name, "package.json");
            const text = await readFile(path.join(root, file), "utf8").catch(() => undefined);
            return text === undefined
              ? []
              : [{ area, file, manifest: JSON.parse(text) as unknown }];
          }),
      );
    }),
  );
  return found.flat(2);
}

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
