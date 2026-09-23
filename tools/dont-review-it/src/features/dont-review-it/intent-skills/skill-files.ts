import { filesUnder } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";

import type { Effect, FileSystem, PlatformError } from "effect";
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
}): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  filesUnder({
    directory,
    keeps: (relativePath) => path.basename(relativePath) === config.skillFileName,
  });
