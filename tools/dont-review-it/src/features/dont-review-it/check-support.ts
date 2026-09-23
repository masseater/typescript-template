import { Effect, type FileSystem } from "effect";
import { isAgent, isColorSupported } from "std-env";

import { defaultEntryCompositionConfig } from "./entry-composition/config.ts";
import { writeEntryComposition } from "./entry-composition/write-entry-composition.ts";
import { defaultIntentSkillsConfig } from "./intent-skills/config.ts";
import { writeSkillVersions } from "./intent-skills/write-skill-versions.ts";
import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND } from "./repository-checks/index.ts";
import { runChecks } from "./run-checks.ts";
import { scanTraceFor } from "./scan-trace/scan-trace-report.ts";

import type { PlatformError } from "effect";
import type { LintRuleWorkspaceFailure } from "./lint-rule-authoring/rule-index/lint-rule-workspaces.ts";

export const refuseMisuse = (complaint: string): void => {
  process.stderr.write(complaint);
  process.exitCode = EXIT_MISUSE;
};

export const repairGeneratedParts = (
  repositoryRoot: string,
): Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* repairGeneratedParts() {
    const entries = yield* writeEntryComposition({
      repositoryRoot,
      config: defaultEntryCompositionConfig,
    });
    const skills = yield* writeSkillVersions({ repositoryRoot, config: defaultIntentSkillsConfig });
    const failures = [...entries.failures, ...skills.failures];
    if (failures.length === 0) return true;
    refuseMisuse(failures.map((failure) => `${failure}\n`).join(""));
    return false;
  });

export const reportProblems = (
  repositoryRoot: string,
): Effect.Effect<void, LintRuleWorkspaceFailure, FileSystem.FileSystem> =>
  Effect.gen(function* reportProblems() {
    const { outcomes, problems, warnings, failures } = yield* runChecks(repositoryRoot);
    const lines = [...problems, ...warnings.map((warning) => `warning: ${warning}`)];
    if (lines.length > 0) process.stdout.write(lines.map((line) => `${line}\n`).join(""));
    process.stderr.write(
      scanTraceFor({ outcomes, readByAgent: isAgent, colored: isColorSupported }),
    );
    if (failures.length > 0) {
      refuseMisuse(failures.map((failure) => `${failure}\n`).join(""));
      return;
    }
    if (problems.length > 0) process.exitCode = EXIT_PROBLEMS_FOUND;
  });
