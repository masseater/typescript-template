import { Effect, FileSystem, type PlatformError } from "effect";

import { isFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { isMissingPath } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";
import { failureCodeOf } from "../repository-checks/index.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { RequiredFileFormConfig } from "./config.ts";

type LinkedEntry =
  | { readonly kind: "missing" }
  | { readonly kind: "link"; readonly pointsAt: string }
  | { readonly kind: "copy" };

const NOT_A_LINK_CODE = "EINVAL";

const linkedEntryAt = (
  linkedPath: string,
): Effect.Effect<LinkedEntry, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* linkedEntryAt() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readLink(linkedPath).pipe(
      Effect.map((pointsAt): LinkedEntry => ({ kind: "link", pointsAt })),
      Effect.catchIf(isMissingPath, () => Effect.succeed<LinkedEntry>({ kind: "missing" })),
      Effect.catchIf(
        (unreadLink) => failureCodeOf(unreadLink.reason.cause) === NOT_A_LINK_CODE,
        () => Effect.succeed<LinkedEntry>({ kind: "copy" }),
      ),
    );
  });

export const agentInstructionLinksIn = ({
  repositoryRoot,
  packageRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly packageRoot: string;
  readonly config: RequiredFileFormConfig;
}): Effect.Effect<
  readonly RepositoryProblem[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* agentInstructionLinksIn() {
    const instructionExists = isFile(
      path.join(repositoryRoot, packageRoot, config.agentInstructionFileName),
    );
    const linked = yield* linkedEntryAt(
      path.join(repositoryRoot, packageRoot, config.linkedAgentInstructionFileName),
    );

    if (linked.kind === "missing") {
      return instructionExists
        ? [
            {
              file: path.normalize(`${packageRoot}/${config.linkedAgentInstructionFileName}`),
              line: null,
              message: `A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to ${config.agentInstructionFileName}.`,
            },
          ]
        : [];
    }

    if (!instructionExists) {
      return [
        {
          file: path.normalize(`${packageRoot}/${config.agentInstructionFileName}`),
          line: null,
          message: `Agent instructions must not live under ${config.linkedAgentInstructionFileName} alone. Write them here and leave ${config.linkedAgentInstructionFileName} pointing at this file.`,
        },
      ];
    }

    return linked.kind === "link" && linked.pointsAt === config.agentInstructionFileName
      ? []
      : [
          {
            file: path.normalize(`${packageRoot}/${config.linkedAgentInstructionFileName}`),
            line: null,
            message: `Agent instructions must not be spelled twice. Replace this file with a symbolic link to ${config.agentInstructionFileName}.`,
          },
        ];
  });
