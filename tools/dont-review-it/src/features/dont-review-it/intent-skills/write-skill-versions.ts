import { Effect, FileSystem, type PlatformError } from "effect";
import { parseTree } from "jsonc-parser";

import {
  listRepositoryFiles,
  type ScannedFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { failureMessageOf } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";
import { propertyValueOf } from "./manifest.ts";
import { declaredVersionOf, type SkillPackage } from "./shipped-versions.ts";
import { listSkillFiles, skillsDirectoryOf } from "./skill-files.ts";
import { withLibraryVersion } from "./skill-version.ts";

import type { IntentSkillsConfig } from "./config.ts";

export type SkillVersionWriteReport = {
  readonly failures: readonly string[];
};

const publishedScopeOf = ({
  file,
  config,
  repositoryRoot,
}: {
  readonly file: ScannedFile;
  readonly config: IntentSkillsConfig;
  readonly repositoryRoot: string;
}): Effect.Effect<SkillPackage | null, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* publishedScopeOf() {
    const filesystem = yield* FileSystem.FileSystem;
    const source = yield* filesystem.readFileString(file.absolutePath);
    const root = parseTree(source);
    if (root === undefined || typeof propertyValueOf(root, "name") !== "string") return null;
    if (propertyValueOf(root, "private") === true) return null;

    return { manifest: { file, source, root }, config, repositoryRoot };
  });

const rewriteSkillFile = ({
  scope,
  version,
  skillFile,
}: {
  readonly scope: SkillPackage;
  readonly version: string;
  readonly skillFile: string;
}): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* rewriteSkillFile() {
    const filesystem = yield* FileSystem.FileSystem;
    const source = yield* filesystem.readFileString(skillFile);
    const rewritten = withLibraryVersion({ source, version });
    if (rewritten === source) return [];

    return yield* filesystem.writeFileString(skillFile, rewritten).pipe(
      Effect.as([]),
      Effect.catch((unwritable) =>
        Effect.succeed([
          `${path.relative(scope.repositoryRoot, skillFile)} could not be rewritten: ${failureMessageOf(unwritable)}`,
        ]),
      ),
    );
  });

const scopeFailures = (
  scope: SkillPackage,
): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* scopeFailures() {
    const version = declaredVersionOf(scope);
    if (version === null) return [];

    const skillFiles = yield* listSkillFiles({
      directory: skillsDirectoryOf(scope),
      config: scope.config,
    });
    const failures = yield* Effect.forEach(skillFiles, (skillFile) =>
      rewriteSkillFile({ scope, version, skillFile }),
    );
    return failures.flat();
  });

export const writeSkillVersions = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: IntentSkillsConfig;
}): Effect.Effect<SkillVersionWriteReport, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* writeSkillVersions() {
    const scopes = yield* Effect.forEach(listRepositoryFiles(repositoryRoot).manifests, (file) =>
      publishedScopeOf({ file, config, repositoryRoot }),
    );
    const failures = yield* Effect.forEach(
      scopes.filter((scope): scope is SkillPackage => scope !== null),
      scopeFailures,
    );
    return { failures: failures.flat().toSorted() };
  });
