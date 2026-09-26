import { Effect, type FileSystem, Schema } from "effect";
import { attempt, isPlainObject } from "es-toolkit";
import { parse } from "yaml";

import { textOrNull } from "../../platform/file-system.ts";
import { path } from "../../platform/path.ts";
import { directoriesMatching } from "../../platform/workspace-patterns.ts";

import type { TreeFailure } from "../../platform/directory-entries.ts";

export type LintRuleWorkspace = {
  readonly workspaceDir: string;
  readonly ruleDirectories: readonly string[];
};

class WorkspaceDefinitionUnparsable extends Schema.TaggedError<WorkspaceDefinitionUnparsable>()(
  "WorkspaceDefinitionUnparsable",
  { file: Schema.String, cause: Schema.Defect() },
) {
  override get message(): string {
    return `${this.file} exists but does not parse as YAML`;
  }
}

export type LintRuleWorkspaceFailure =
  | TreeFailure
  | WorkspaceDefinitionUnparsable
  | Schema.SchemaError;

const WORKSPACE_DEFINITION_FILE = "pnpm-workspace.yaml";

const WORKSPACE_PATTERNS_FIELD = "packages";

const declaredWorkspaceDirs = (
  repositoryRoot: string,
): Effect.Effect<readonly string[], LintRuleWorkspaceFailure, FileSystem.FileSystem> =>
  Effect.gen(function* declaredWorkspaceDirs() {
    const definitionText = yield* textOrNull(path.join(repositoryRoot, WORKSPACE_DEFINITION_FILE));
    if (definitionText === null) return [];

    const [unparsableDefinition, definition] = attempt((): unknown => parse(definitionText));
    if (unparsableDefinition !== null) {
      return yield* WorkspaceDefinitionUnparsable.make({
        file: WORKSPACE_DEFINITION_FILE,
        cause: unparsableDefinition,
      });
    }
    if (typeof definition !== "object" || definition === null) return [];

    const patterns = (definition as Record<string, unknown>)[WORKSPACE_PATTERNS_FIELD];
    if (!Array.isArray(patterns)) return [];

    const expanded = yield* Effect.forEach(
      patterns.filter((pattern): pattern is string => typeof pattern === "string"),
      (pattern) => directoriesMatching({ repositoryRoot, pattern }),
    );
    return expanded.flat();
  });

const RULE_DIRECTORIES_FIELD = "lintRules";

const ruleDirectoriesDeclaredAt = ({
  repositoryRoot,
  workspaceDir,
}: {
  readonly repositoryRoot: string;
  readonly workspaceDir: string;
}): Effect.Effect<readonly string[], LintRuleWorkspaceFailure, FileSystem.FileSystem> =>
  Effect.gen(function* ruleDirectoriesDeclaredAt() {
    const manifestText = yield* textOrNull(path.join(repositoryRoot, workspaceDir, "package.json"));
    if (manifestText === null) return [];

    const manifest = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(
      manifestText,
    );
    if (!isPlainObject(manifest)) return [];

    const declared: unknown = manifest[RULE_DIRECTORIES_FIELD];
    if (!Array.isArray(declared)) return [];

    return declared.filter(
      (ruleDirectory): ruleDirectory is string => typeof ruleDirectory === "string",
    );
  });

export const lintRuleWorkspacesIn = (
  repositoryRoot: string,
): Effect.Effect<readonly LintRuleWorkspace[], LintRuleWorkspaceFailure, FileSystem.FileSystem> =>
  Effect.gen(function* lintRuleWorkspacesIn() {
    const workspaceDirs = yield* declaredWorkspaceDirs(repositoryRoot);
    const workspaces = yield* Effect.forEach(workspaceDirs, (workspaceDir) =>
      ruleDirectoriesDeclaredAt({ repositoryRoot, workspaceDir }).pipe(
        Effect.map((ruleDirectories) => ({ workspaceDir, ruleDirectories })),
      ),
    );
    return workspaces
      .filter((workspace) => workspace.ruleDirectories.length > 0)
      .toSorted((left, right) => left.workspaceDir.localeCompare(right.workspaceDir));
  });
export type { WorkspaceDefinitionUnparsable };
