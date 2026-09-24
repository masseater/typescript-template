import { Effect, FileSystem, type PlatformError } from "effect";

import { textOrNull } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";
import {
  blockOf,
  normalizedContent,
  regionIn,
  withRefreshedRegion,
  type GeneratedRegion,
} from "./generated-region.ts";
import { REGENERATE_COMMAND } from "./regenerate-command.ts";

import type { LintRuleProblem } from "./lint-rule-problem.ts";

export const staleGeneratedFile = ({
  file,
  behind,
}: {
  readonly file: string;
  readonly behind: string;
}): string =>
  `\`${file}\` must not fall behind ${behind}. Regenerate it with \`${REGENERATE_COMMAND}\`.`;

export type ReconciledProblems = Effect.Effect<
  readonly LintRuleProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
>;

export type GeneratedFile = {
  readonly repositoryRoot: string;
  readonly file: string;
  readonly begin: string;
  readonly end: string;
  readonly expected: string;
  readonly scaffold: (block: string) => string;
  readonly absent: (file: string) => string;
  readonly stale: (file: string) => string;
  readonly write: boolean;
};

const wrappedBlockOf = (reconciled: GeneratedFile): string =>
  blockOf({ begin: reconciled.begin, content: reconciled.expected, end: reconciled.end });

const absentProblems = ({
  reconciled,
  absolutePath,
}: {
  readonly reconciled: GeneratedFile;
  readonly absolutePath: string;
}): ReconciledProblems =>
  Effect.gen(function* absentProblems() {
    if (!reconciled.write) {
      return [{ file: reconciled.file, message: reconciled.absent(reconciled.file) }];
    }
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem.makeDirectory(path.dirname(absolutePath), { recursive: true });
    yield* filesystem.writeFileString(
      absolutePath,
      reconciled.scaffold(wrappedBlockOf(reconciled)),
    );
    return [];
  });

const FRONTMATTER_FENCE = "---\n";

const withInsertedRegion = ({
  source,
  block,
}: {
  readonly source: string;
  readonly block: string;
}): string => {
  const fenceClosesAt = source.startsWith(FRONTMATTER_FENCE)
    ? source.indexOf(`\n${FRONTMATTER_FENCE}`, FRONTMATTER_FENCE.length)
    : -1;
  if (fenceClosesAt === -1) return `${block}\n\n${source}`;

  const frontmatterEndsAt = fenceClosesAt + `\n${FRONTMATTER_FENCE}`.length;
  return `${source.slice(0, frontmatterEndsAt)}\n${block}\n\n${source.slice(frontmatterEndsAt)}`;
};

const lostRegion = (reconciled: GeneratedFile): string =>
  `\`${reconciled.file}\` must not lose its generated region. Put \`${reconciled.begin}\` and \`${reconciled.end}\` back, or delete the file and regenerate it with \`${REGENERATE_COMMAND}\`.`;

const unmarkedProblems = ({
  reconciled,
  absolutePath,
  source,
}: {
  readonly reconciled: GeneratedFile;
  readonly absolutePath: string;
  readonly source: string;
}): ReconciledProblems =>
  Effect.gen(function* unmarkedProblems() {
    if (!reconciled.write) return [{ file: reconciled.file, message: lostRegion(reconciled) }];
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem.writeFileString(
      absolutePath,
      withInsertedRegion({ source, block: wrappedBlockOf(reconciled) }),
    );
    return [];
  });

const staleProblems = ({
  reconciled,
  absolutePath,
  region,
}: {
  readonly reconciled: GeneratedFile;
  readonly absolutePath: string;
  readonly region: GeneratedRegion;
}): ReconciledProblems =>
  Effect.gen(function* staleProblems() {
    if (normalizedContent(region.body) === normalizedContent(reconciled.expected)) return [];
    if (!reconciled.write) {
      return [{ file: reconciled.file, message: reconciled.stale(reconciled.file) }];
    }
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem.writeFileString(
      absolutePath,
      withRefreshedRegion({ region, content: reconciled.expected }),
    );
    return [];
  });

export const generatedFileProblems = (reconciled: GeneratedFile): ReconciledProblems =>
  Effect.gen(function* generatedFileProblems() {
    const absolutePath = path.join(reconciled.repositoryRoot, reconciled.file);
    const source = yield* textOrNull(absolutePath);
    if (source === null) return yield* absentProblems({ reconciled, absolutePath });

    const region = regionIn({ source, begin: reconciled.begin, end: reconciled.end });
    if (region === null) return yield* unmarkedProblems({ reconciled, absolutePath, source });
    return yield* staleProblems({ reconciled, absolutePath, region });
  });
