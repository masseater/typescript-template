import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { field } from "@repo/dont-review-it/record-fields";

import { repositoryRelative } from "./repository-path.ts";
import { replacementFor, replacementMessage } from "./retired-packages.ts";

import type { Application } from "@repo/config";

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

type LocalExecutableName = "commander";

const localExecutableName = "commander" satisfies LocalExecutableName extends Application
  ? never
  : LocalExecutableName;
const localExecutablePackage = `@repo/${localExecutableName}`;
const localExecutableDirectory = `tools/${localExecutableName}`;

const localExecutablePlacementViolations = (workspaces: readonly WorkspaceManifest[]): string[] => {
  const owned = workspaces.filter(
    ({ manifest }) => field(manifest, "name") === localExecutablePackage,
  );
  const owner = owned.length === 1 ? owned[0] : undefined;
  const placed =
    owner !== undefined &&
    owner.area === "tools" &&
    owner.file === `${localExecutableDirectory}/package.json`;
  const place = placed
    ? []
    : [
        `${localExecutablePackage} は ${localExecutableDirectory} に 1 つだけ置いてください。デプロイして外部の要求を受けるなら apps/ へ移してください。`,
      ];
  const imported = workspaces.flatMap(({ file, manifest }) => {
    if (field(manifest, "name") === localExecutablePackage) {
      return [];
    }
    return declaredDependencies(manifest)
      .filter((dependency) => dependency === localExecutablePackage)
      .map(
        (dependency) =>
          `${file}: ${dependency} は手元だけで起動する実行対象です。依存を外し、共有したい処理は libs/ へ切り出してください。`,
      );
  });
  return [...place, ...imported];
};

const localExecutableDeployViolations = (deployed: readonly string[]): string[] => {
  return deployed.includes(localExecutableName)
    ? [
        `${localExecutableName} はデプロイされて外部の要求を受ける実行対象です。apps/ へ移してください。`,
      ]
    : [];
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
  path.relative(root, absolute).split(path.sep).join("/");

const includeReference = (absolute: string, name: string): boolean => {
  if (name === "vite.config.ts" || name === "package.json") {
    return true;
  }
  return name.endsWith(".md") && absolute.split(path.sep).includes("skills");
};

const commandReferences = (root: string, directory = root): readonly SurfaceReference[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (skippedReferenceDirectory.has(entry.name)) {
      return [];
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return [...commandReferences(root, absolute)];
    }
    if (!includeReference(absolute, entry.name)) {
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
  field,
  localExecutableDeployViolations,
  localExecutableName,
  localExecutablePlacementViolations,
  publishableSurfaceViolations,
  retiredDependencyViolations,
  rootOnlyDependencyViolations,
  rootOnlyPackages,
  workspaceManifests,
};
export type { WorkspaceManifest };
