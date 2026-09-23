import { Effect, type FileSystem, type PlatformError } from "effect";

import { filesUnder } from "../../platform/file-system.ts";
import { path } from "../../platform/path.ts";

import type { LintRuleWorkspace } from "./lint-rule-workspaces.ts";

const EXCLUDED_DIRECTORY_NAMES: readonly string[] = ["node_modules", "dist", "coverage", "lib"];

const SOURCE_FILE_SUFFIXES: readonly string[] = [".ts", ".tsx", ".js", ".jsx"];

const TEST_FILE_MARKER = ".test.";

const TYPE_DECLARATION_SUFFIX = ".d.ts";

const isRuleSourceFileName = (fileName: string): boolean =>
  SOURCE_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix)) &&
  !fileName.includes(TEST_FILE_MARKER) &&
  !fileName.endsWith(TYPE_DECLARATION_SUFFIX);

const isRuleSourcePath = (relativePath: string): boolean => {
  const segments = relativePath.split(path.sep);
  return (
    isRuleSourceFileName(segments.at(-1) ?? "") &&
    !segments.slice(0, -1).some((segment) => EXCLUDED_DIRECTORY_NAMES.includes(segment))
  );
};

export const ruleSourceFilesIn = ({
  repositoryRoot,
  workspace,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
}): Effect.Effect<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* ruleSourceFilesIn() {
    const workspaceRoot = path.join(repositoryRoot, workspace.workspaceDir);
    const ruleFiles = yield* Effect.forEach(workspace.ruleDirectories, (ruleDirectory) =>
      filesUnder({ directory: path.join(workspaceRoot, ruleDirectory), keeps: isRuleSourcePath }),
    );
    return ruleFiles
      .flat()
      .map((absolutePath) => path.relative(workspaceRoot, absolutePath))
      .toSorted();
  });
