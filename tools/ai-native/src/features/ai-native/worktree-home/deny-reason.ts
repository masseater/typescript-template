import { Effect } from "effect";

import { bashCommandOf } from "../bash-command.ts";
import { resolvePath } from "../host.ts";
import { findWorktreeAdds, unresolvedWord, type WorktreeAdd } from "./find-worktree-adds.ts";
import { insideRepositoryReason, unresolvedDestinationReason } from "./message.ts";

export type WorktreeGuardInquiry = Readonly<{
  cwd: string;
  home: string;
  repositoryRootOf: (directory: string) => Effect.Effect<string | undefined>;
  toolInput: unknown;
  toolName: string;
}>;

const isLiteral = (word: string): boolean =>
  word !== unresolvedWord && !word.includes("$") && !word.includes("`");

const expandedHome = (word: string, home: string): string =>
  word === "~" || word.startsWith("~/") ? `${home}${word.slice(1)}` : word;

const isWithin = (candidate: string, root: string): boolean =>
  candidate === root || candidate.startsWith(`${root}/`);

const reasonForAdd = (
  worktreeAdd: WorktreeAdd,
  inquiry: WorktreeGuardInquiry,
): Effect.Effect<string | undefined> => {
  const words = [...worktreeAdd.directories, worktreeAdd.target ?? unresolvedWord];
  if (!words.every(isLiteral)) {
    return Effect.succeed(unresolvedDestinationReason);
  }
  const base = resolvePath(
    inquiry.cwd,
    ...worktreeAdd.directories.map((directory) => expandedHome(directory, inquiry.home)),
  );
  const destination = resolvePath(base, expandedHome(worktreeAdd.target ?? "", inquiry.home));
  return inquiry
    .repositoryRootOf(base)
    .pipe(
      Effect.map((repositoryRoot) =>
        repositoryRoot !== undefined && isWithin(destination, repositoryRoot)
          ? insideRepositoryReason(destination, repositoryRoot)
          : undefined,
      ),
    );
};

export const denyReasonOf = (inquiry: WorktreeGuardInquiry): Effect.Effect<string | undefined> =>
  Effect.forEach(
    inquiry.toolName === "Bash" ? findWorktreeAdds(bashCommandOf(inquiry.toolInput)) : [],
    (worktreeAdd) => reasonForAdd(worktreeAdd, inquiry),
  ).pipe(Effect.map((reasons) => reasons.find((reason) => reason !== undefined)));
