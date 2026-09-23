import { Effect, FileSystem } from "effect";
import { parseTree } from "jsonc-parser";

import {
  listRepositoryFiles,
  type ScannedFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { lineOfProperty, propertyValueOf, stringEntriesOf } from "./manifest.ts";
import {
  publishedVersionProblems,
  unexpectedChangelogProblems,
  type SkillPackage,
} from "./shipped-versions.ts";
import { listSkillFiles, skillsDirectoryOf } from "./skill-files.ts";

import type { TreeFailure } from "../platform/directory-entries.ts";
import type { RepositoryProblem } from "../problem.ts";
import type { ScannedProblems } from "../repository-checks/index.ts";
import type { IntentSkillsConfig } from "./config.ts";

type ScopeProblems = Effect.Effect<
  readonly RepositoryProblem[],
  TreeFailure,
  FileSystem.FileSystem
>;

const shipsSkillFile = (
  scope: SkillPackage,
): Effect.Effect<boolean, TreeFailure, FileSystem.FileSystem> =>
  listSkillFiles({ directory: skillsDirectoryOf(scope), config: scope.config }).pipe(
    Effect.map((skillFiles) => skillFiles.length > 0),
  );

const missingSkillFiles = (scope: SkillPackage): ScopeProblems =>
  Effect.gen(function* missingSkillFiles() {
    const { manifest, config } = scope;
    if (yield* shipsSkillFile(scope)) return [];

    return [
      {
        file: manifest.file.relativePath,
        line: lineOfProperty({ manifest, key: "name" }),
        message: `A package that npm can publish must not ship without a TanStack Intent skill, because an agent that installs it finds nothing to load. Create ${config.skillsDirectory}/<topic>/${config.skillFileName} with npx @tanstack/intent scaffold, or mark the package "private": true.`,
      },
    ];
  });

const missingFilesEntry = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "files"));
  if (declared === null || declared.includes(config.requiredFilesEntry)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "files" }),
      message: `The files allowlist must not leave out the ${config.requiredFilesEntry} directory, because npm packs only what files names and the published archive would drop every ${config.skillFileName}. Add "${config.requiredFilesEntry}" to files.`,
    },
  ];
};

const missingKeyword = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "keywords")) ?? [];
  if (declared.includes(config.requiredKeyword)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "keywords" }),
      message: `The manifest must not omit the ${config.requiredKeyword} keyword, because TanStack Intent detects skill-shipping packages by it. Add "${config.requiredKeyword}" to keywords.`,
    },
  ];
};

const missingProblems = (scope: SkillPackage): ScopeProblems =>
  Effect.gen(function* missingProblems() {
    const skillFileProblems = yield* missingSkillFiles(scope);
    const versionProblems = yield* publishedVersionProblems(scope);
    return [
      ...skillFileProblems,
      ...missingFilesEntry(scope),
      ...missingKeyword(scope),
      ...versionProblems,
    ];
  });

const unexpectedFilesEntry = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "files")) ?? [];
  if (!declared.includes(config.requiredFilesEntry)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "files" }),
      message: `The files allowlist of a workspace-internal package must not name the ${config.requiredFilesEntry} directory, because nothing is ever packed from a package that npm cannot publish. Remove "${config.requiredFilesEntry}" from files.`,
    },
  ];
};

const unexpectedSkillFiles = (scope: SkillPackage): ScopeProblems =>
  Effect.gen(function* unexpectedSkillFiles() {
    const { manifest, config } = scope;
    if (!(yield* shipsSkillFile(scope))) return [];

    return [
      {
        file: manifest.file.relativePath,
        line: lineOfProperty({ manifest, key: "private" }),
        message: `A workspace-internal package must not carry TanStack Intent skills, because a skill that never ships trains agents on a surface nobody can install. Delete the ${config.skillsDirectory} directory, or let the package publish by removing "private": true.`,
      },
    ];
  });

const unexpectedKeyword = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "keywords")) ?? [];
  if (!declared.includes(config.requiredKeyword)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "keywords" }),
      message: `A workspace-internal package must not carry the ${config.requiredKeyword} keyword, because discovery would announce skills the package never ships. Remove "${config.requiredKeyword}" from keywords.`,
    },
  ];
};

const unexpectedProblems = (scope: SkillPackage): ScopeProblems =>
  Effect.gen(function* unexpectedProblems() {
    const skillFileProblems = yield* unexpectedSkillFiles(scope);
    const changelogProblems = yield* unexpectedChangelogProblems(scope);
    return [
      ...skillFileProblems,
      ...unexpectedFilesEntry(scope),
      ...unexpectedKeyword(scope),
      ...changelogProblems,
    ];
  });

const manifestProblems = ({
  file,
  config,
  repositoryRoot,
}: {
  readonly file: ScannedFile;
  readonly config: IntentSkillsConfig;
  readonly repositoryRoot: string;
}): ScopeProblems =>
  Effect.gen(function* manifestProblems() {
    const filesystem = yield* FileSystem.FileSystem;
    const source = yield* filesystem.readFileString(file.absolutePath);
    const root = parseTree(source);
    if (root === undefined || typeof propertyValueOf(root, "name") !== "string") return [];

    const scope = { manifest: { file, source, root }, config, repositoryRoot };
    return yield* propertyValueOf(root, "private") === true
      ? unexpectedProblems(scope)
      : missingProblems(scope);
  });

export const shippedSkillsProblems = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: IntentSkillsConfig;
}): Effect.Effect<ScannedProblems, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* shippedSkillsProblems() {
    const manifests = listRepositoryFiles(repositoryRoot).manifests;
    const problems = yield* Effect.forEach(manifests, (file) =>
      manifestProblems({ file, config, repositoryRoot }),
    );
    return { problems: problems.flat(), scanned: manifests.length };
  });
