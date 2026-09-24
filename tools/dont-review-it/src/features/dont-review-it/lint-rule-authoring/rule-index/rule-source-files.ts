import { Effect, type FileSystem } from "effect";

import { filesUnder, type TreeFailure } from "../../platform/directory-entries.ts";
import { path, relativePosixPath } from "../../platform/path.ts";

import type { LintRuleWorkspace } from "./lint-rule-workspaces.ts";

const EXCLUDED_DIRECTORY_NAMES: readonly string[] = ["node_modules", "dist", "coverage", "lib"];

const SOURCE_FILE_SUFFIXES: readonly string[] = [".ts", ".tsx", ".js", ".jsx"];

const TEST_FILE_MARKER = ".test.";

const TYPE_DECLARATION_SUFFIX = ".d.ts";

const isRuleSourceFileName = (fileName: string): boolean =>
  SOURCE_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix)) &&
  !fileName.includes(TEST_FILE_MARKER) &&
  !fileName.endsWith(TYPE_DECLARATION_SUFFIX);

export type RuleSourceFiles = {
  readonly sourcePaths: readonly string[];
  readonly absentDirectories: readonly string[];
};

export const ruleSourceFilesIn = ({
  repositoryRoot,
  workspace,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
}): Effect.Effect<RuleSourceFiles, TreeFailure, FileSystem.FileSystem> =>
  Effect.gen(function* ruleSourceFilesIn() {
    const workspaceRoot = path.join(repositoryRoot, workspace.workspaceDir);
    const walked = yield* Effect.forEach(workspace.ruleDirectories, (ruleDirectory) =>
      filesUnder({
        directory: path.join(workspaceRoot, ruleDirectory),
        prunedDirectoryNames: EXCLUDED_DIRECTORY_NAMES,
        keepsFileName: isRuleSourceFileName,
      }).pipe(Effect.map((files) => ({ ruleDirectory, files }))),
    );
    return {
      sourcePaths: walked
        .flatMap(({ files }) => files ?? [])
        .map((absolutePath) => relativePosixPath(workspaceRoot, absolutePath))
        .toSorted(),
      absentDirectories: walked
        .filter(({ files }) => files === null)
        .map(({ ruleDirectory }) => ruleDirectory),
    };
  });
