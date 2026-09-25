import { Effect } from "effect";

import { type TreeScan } from "../platform/directory-entries.ts";
import { posixPath } from "../platform/path.ts";
import {
  declaredDependencies,
  field,
  type WorkspaceManifest,
} from "./dependencies-test-fixture.ts";
import { repositoryRoot } from "./repository-root.ts";
import {
  moduleSpecifiers,
  relativeImports,
  repositorySources,
  repositoryWorkspaces,
  workspaceOf,
  type Finding,
  type SourceText,
} from "./single-consumer-test-fixture.ts";
import { testPattern } from "./test-runtime.ts";

const testFixture = String.raw`-test-fixture\.[cm]?[jt]sx?$`;
const testFixtureEntry = new RegExp(testFixture, "u");
const testOnlyImporter = new RegExp(`${testPattern}|${testFixture}`, "u");

const workspaceDirectory = (workspace: WorkspaceManifest): string => {
  const directory = posixPath.dirname(workspace.file);
  return directory === "." ? "root" : directory;
};

const packageOf = (specifier: string): string => specifier.split("/").slice(0, 2).join("/");

const isWorkspaceSource = (source: SourceText): boolean => source.file.split("/")[2] === "src";

const undeclaredImportFindings = (
  workspaces: readonly WorkspaceManifest[],
  sources: readonly SourceText[],
): readonly Finding[] => {
  const manifests = new Map(
    workspaces.map((workspace) => [workspaceDirectory(workspace), workspace.manifest]),
  );
  return sources.filter(isWorkspaceSource).flatMap((source) => {
    const importer = workspaceOf(source.file);
    const manifest = manifests.get(importer);
    const declared = new Set([field(manifest, "name"), ...declaredDependencies(manifest)]);
    return [...new Set(moduleSpecifiers(source.file, source.text).map(packageOf))]
      .filter((imported) => !declared.has(imported))
      .map((imported) => ({
        id: `undeclared:${source.file}:${imported}`,
        message: `${source.file}: ${imported} を import していますが、${importer}/package.json の依存に宣言がありません。`,
      }));
  });
};

interface Entry {
  readonly file: string;
  readonly specifier: string;
  readonly target: string;
}

const entrySpecifier = (name: string, key: string): string | undefined => {
  if (key === ".") {
    return name;
  }
  return key.startsWith("./") && !key.includes("*") && key !== "./package.json"
    ? `${name}/${key.slice(2)}`
    : undefined;
};

const packageEntries = (workspace: WorkspaceManifest): readonly Entry[] => {
  const name = field(workspace.manifest, "name");
  const exportsField = field(workspace.manifest, "exports");
  if (typeof name !== "string" || typeof exportsField !== "object" || exportsField === null) {
    return [];
  }
  return Object.entries(exportsField).flatMap(([key, target]: readonly [string, unknown]) => {
    const specifier = entrySpecifier(name, key);
    return specifier === undefined || typeof target !== "string"
      ? []
      : [
          {
            file: workspace.file,
            specifier,
            target: posixPath.join(workspaceDirectory(workspace), target),
          },
        ];
  });
};

const testOnlyEntryFindings = (
  workspaces: readonly WorkspaceManifest[],
  sources: readonly SourceText[],
): readonly Finding[] => {
  const imports = sources.map((source) => ({
    file: source.file,
    imported: new Set([
      ...moduleSpecifiers(source.file, source.text),
      ...relativeImports(source.file, source.text),
    ]),
  }));
  return workspaces.flatMap(packageEntries).flatMap((entry) => {
    if (testFixtureEntry.test(entry.target)) {
      return [];
    }
    const importers = imports
      .filter(({ imported }) => imported.has(entry.specifier) || imported.has(entry.target))
      .map(({ file }) => file);
    return importers.length > 0 && importers.every((file) => testOnlyImporter.test(file))
      ? [
          {
            id: `test-only:${entry.specifier}`,
            message: `${entry.file}: ${entry.specifier} はテストからしか import されていません。テスト専用の入口は -test-fixture で終わる名前のファイルにしてください（${entry.target}）。`,
          },
        ]
      : [];
  });
};

const repositoryPackageEntryFindings: TreeScan<readonly Finding[]> = Effect.map(
  repositorySources(repositoryRoot),
  (sources) => {
    const workspaces = repositoryWorkspaces();
    return [
      ...undeclaredImportFindings(workspaces, sources),
      ...testOnlyEntryFindings(workspaces, sources),
    ];
  },
);

export { repositoryPackageEntryFindings, testOnlyEntryFindings, undeclaredImportFindings };
