import { Effect, type FileSystem } from "effect";

import { filesUnder, type TreeFailure } from "../platform/directory-entries.ts";
import { path } from "../platform/path.ts";

import type { IntentSkillsConfig } from "./config.ts";
import type { PublishedManifest } from "./manifest.ts";

export const skillsDirectoryOf = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): string => path.join(path.dirname(manifest.file.absolutePath), config.skillsDirectory);

export const listSkillFiles = ({
  directory,
  config,
}: {
  readonly directory: string;
  readonly config: IntentSkillsConfig;
}): Effect.Effect<readonly string[], TreeFailure, FileSystem.FileSystem> =>
  filesUnder({
    directory,
    prunedDirectoryNames: [],
    keepsFileName: (fileName) => fileName === config.skillFileName,
  }).pipe(Effect.map((skillFiles) => skillFiles ?? []));
