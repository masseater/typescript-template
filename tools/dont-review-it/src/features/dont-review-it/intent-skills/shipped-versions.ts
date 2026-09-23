import { Effect, FileSystem, type PlatformError } from "effect";

import { textOrNull } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";
import { declaresVersion } from "./changelog.ts";
import { lineOfProperty, propertyValueOf, type PublishedManifest } from "./manifest.ts";
import { listSkillFiles, skillsDirectoryOf } from "./skill-files.ts";
import { libraryVersionOf, lineOfLibraryVersion } from "./skill-version.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { IntentSkillsConfig } from "./config.ts";

export type SkillPackage = {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
  readonly repositoryRoot: string;
};

const changelogPathOf = ({ manifest, config }: SkillPackage): string =>
  path.join(skillsDirectoryOf({ manifest, config }), config.changelogFileName);

const changelogSourceOf = (
  scope: SkillPackage,
): Effect.Effect<string | null, PlatformError.PlatformError, FileSystem.FileSystem> =>
  textOrNull(changelogPathOf(scope));

export const declaredVersionOf = ({ manifest }: SkillPackage): string | null => {
  const declared = propertyValueOf(manifest.root, "version");
  return typeof declared === "string" ? declared : null;
};

const missingChangelog = (scope: SkillPackage): readonly RepositoryProblem[] => {
  const { manifest, config } = scope;
  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "name" }),
      message: `A package that npm can publish must not ship its skills without a changelog beside them, because the agent that loads a skill cannot tell what the version it installed changed. Create ${config.skillsDirectory}/${config.changelogFileName} with a "## <version>" heading for every published version.`,
    },
  ];
};

const relativeTo = ({ repositoryRoot }: SkillPackage, absolutePath: string): string =>
  path.relative(repositoryRoot, absolutePath);

const missingVersionHeading = ({
  scope,
  version,
}: {
  readonly scope: SkillPackage;
  readonly version: string;
}): readonly RepositoryProblem[] => [
  {
    file: relativeTo(scope, changelogPathOf(scope)),
    line: null,
    message: `The changelog must not leave a published version undescribed, because the archive would carry a version nobody wrote down. Add a "## ${version}" heading stating what this version changes for the packages that install it.`,
  },
];

const staleLibraryVersion = ({
  scope,
  version,
  skillFile,
}: {
  readonly scope: SkillPackage;
  readonly version: string;
  readonly skillFile: string;
}): Effect.Effect<
  readonly RepositoryProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* staleLibraryVersion() {
    const filesystem = yield* FileSystem.FileSystem;
    const source = yield* filesystem.readFileString(skillFile);
    if (libraryVersionOf(source) === version) return [];

    return [
      {
        file: relativeTo(scope, skillFile),
        line: lineOfLibraryVersion(source),
        message: `A shipped skill must not name a version its manifest no longer declares, because an agent reads library_version to decide whether the skill describes the package it installed. Set metadata.library_version to "${version}", or run dont-review-it check --write.`,
      },
    ];
  });

export const publishedVersionProblems = (
  scope: SkillPackage,
): Effect.Effect<
  readonly RepositoryProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* publishedVersionProblems() {
    const version = declaredVersionOf(scope);
    if (version === null) return [];

    const changelog = yield* changelogSourceOf(scope);
    if (changelog === null) return missingChangelog(scope);

    const skillFiles = yield* listSkillFiles({
      directory: skillsDirectoryOf(scope),
      config: scope.config,
    });
    const staleSkills = yield* Effect.forEach(skillFiles, (skillFile) =>
      staleLibraryVersion({ scope, version, skillFile }),
    );

    return [
      ...(declaresVersion({ source: changelog, version })
        ? []
        : missingVersionHeading({ scope, version })),
      ...staleSkills.flat(),
    ];
  });

export const unexpectedChangelogProblems = (
  scope: SkillPackage,
): Effect.Effect<
  readonly RepositoryProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* unexpectedChangelogProblems() {
    const { manifest, config } = scope;
    if ((yield* changelogSourceOf(scope)) === null) return [];

    return [
      {
        file: manifest.file.relativePath,
        line: lineOfProperty({ manifest, key: "private" }),
        message: `A workspace-internal package must not carry a changelog beside its skills, because nothing is ever packed from a package npm cannot publish. Delete ${config.skillsDirectory}/${config.changelogFileName}, or let the package publish by removing "private": true.`,
      },
    ];
  });
