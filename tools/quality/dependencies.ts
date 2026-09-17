// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, readdir } from "node:fs/promises";

interface WorkspaceManifest {
  readonly area: string;
  readonly file: string;
  readonly manifest: unknown;
}

const workspaceAreas = ["apps", "libs", "infra", "tools"] as const;
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

async function readManifest(
  root: string,
  area: string,
  directory: string,
): Promise<WorkspaceManifest[]> {
  const file = `${area}/${directory}/package.json`;
  try {
    const text = await readFile(new URL(file, root), "utf-8");
    return [{ area, file, manifest: JSON.parse(text) as unknown }];
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readAreaManifests(root: string, area: string): Promise<WorkspaceManifest[]> {
  const entries = await readdir(new URL(`${area}/`, root), { withFileTypes: true });
  const found = await Promise.all(
    entries
      .filter((entry: Readonly<{ isDirectory: () => boolean }>) => entry.isDirectory())
      .map(async (entry: Readonly<{ name: string }>) => readManifest(root, area, entry.name)),
  );
  return found.flat();
}

async function readWorkspaceManifests(root: string): Promise<WorkspaceManifest[]> {
  const found = await Promise.all(
    workspaceAreas.map(async (area) => readAreaManifests(root, area)),
  );
  return found.flat();
}

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

export { applicationDependencyViolations, field, readWorkspaceManifests };
export type { WorkspaceManifest };
