import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

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
> = {
  "react-doctor": {
    owners: ["tools/dont-review-it/package.json"],
    runner: "ルートの vp run check:react",
  },
};

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

const skippedReferenceDirectory = new Set([
  ".git",
  ".local",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);

const recordKeys = (value: unknown): readonly string[] =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? Object.keys(value) : [];

const codeExportKeys = (manifest: unknown): readonly string[] =>
  recordKeys(field(manifest, "exports")).filter(
    (key) => key !== "./package.json" && !key.startsWith("./tsconfig"),
  );

const isPublishable = (manifest: unknown): boolean => {
  if (field(manifest, "private") === true) {
    return false;
  }
  return field(field(manifest, "publishConfig"), "access") === "public";
};

interface SurfaceReference {
  readonly file: string;
  readonly text: string;
}

const relativePosix = (root: string, absolute: string): string =>
  relative(root, absolute).split(sep).join("/");

const includeReference = (absolute: string, name: string): boolean => {
  if (name === "vite.config.ts" || name === "package.json") {
    return true;
  }
  return name.endsWith(".md") && absolute.split(sep).includes("skills");
};

const commandReferences = (root: string, directory = root): readonly SurfaceReference[] =>
  readdirSync(directory).flatMap((name) => {
    if (skippedReferenceDirectory.has(name)) {
      return [];
    }
    const absolute = join(directory, name);
    if (statSync(absolute, { throwIfNoEntry: false })?.isDirectory() === true) {
      return [...commandReferences(root, absolute)];
    }
    if (!includeReference(absolute, name)) {
      return [];
    }
    return [{ file: relativePosix(root, absolute), text: readFileSync(absolute, "utf8") }];
  });

const namesCommand = (
  name: string,
  references: readonly SurfaceReference[],
  packageFile: string,
): boolean => {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  const pattern = new RegExp(String.raw`(?<![\w-])${escaped}(?![\w-])`, "u");
  return references.some(
    (reference) => reference.file !== packageFile && pattern.test(reference.text),
  );
};

const publishableSurfaceViolations = (
  workspaces: readonly WorkspaceManifest[],
  references: readonly SurfaceReference[],
): string[] => {
  return workspaces.flatMap(({ file, manifest }) => {
    if (!isPublishable(manifest)) {
      return [];
    }
    const name = field(manifest, "name");
    const label = typeof name === "string" ? name : file;
    const bins = recordKeys(field(manifest, "bin"));
    const publishedBins = recordKeys(field(field(manifest, "publishConfig"), "bin"));
    const codeExports = codeExportKeys(manifest);
    if (bins.length === 0) {
      return [];
    }
    if (codeExports.length === 0) {
      const missing = bins.filter((bin) => !publishedBins.includes(bin));
      return missing.length === 0
        ? []
        : [
            `${file}: ${label} はコマンドだけの公開パッケージです。bin はすべて publishConfig.bin に置いてください。欠けている名前: ${missing.join(", ")}`,
          ];
    }
    const publishedExports = recordKeys(field(field(manifest, "publishConfig"), "exports"));
    const publishesCode = codeExports.some((key) => publishedExports.includes(key));
    const unpublished = bins.filter((bin) => !publishedBins.includes(bin));
    const uncalled = unpublished.filter((bin) => !namesCommand(bin, references, file));
    if (publishedBins.length > 0 && publishesCode && uncalled.length === 0) {
      return [];
    }
    const detail = [
      publishedBins.length === 0 ? "publishConfig.bin がありません" : "",
      publishesCode ? "" : "publishConfig.exports にコードのサブパスがありません",
      uncalled.length === 0 ? "" : `未参照のコマンド: ${uncalled.join(", ")}`,
    ].filter((part) => part !== "");
    return [
      `${file}: ${label} は取り込み面とコマンド面を両方宣言しています。公開する面は publishConfig に置き、公開しないコマンドはリポジトリの起動から参照してください。${detail.join("。")}`,
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
  commandReferences,
  declaredDependencies,
  developmentOnlyDependencyViolations,
  field,
  libraryMixedSurfaceViolations,
  publishableSurfaceViolations,
  retiredDependencyViolations,
  rootOnlyDependencyViolations,
  rootOnlyPackages,
  workspaceManifests,
};
export type { WorkspaceManifest };
