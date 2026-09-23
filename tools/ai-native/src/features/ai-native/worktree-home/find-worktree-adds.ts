import { parse, type ParseEntry } from "shell-quote";

export const unresolvedWord = "\u0000unresolved";

const commandSeparators: ReadonlySet<string> = new Set([
  "&",
  "&&",
  "(",
  ")",
  ";",
  ";;",
  "<(",
  "|",
  "|&",
  "||",
]);

const simpleCommandsOf = (commandLine: string): readonly (readonly string[])[] =>
  parse(commandLine, (variableName) => `$${variableName}`).reduce<string[][]>(
    (commands, parsedEntry: ParseEntry) => {
      if (typeof parsedEntry === "string") {
        const openCommand = commands.at(-1) ?? [];
        return [...commands.slice(0, -1), [...openCommand, parsedEntry]];
      }
      if ("op" in parsedEntry && commandSeparators.has(parsedEntry.op)) {
        return [...commands, []];
      }
      if ("comment" in parsedEntry) {
        return commands;
      }
      const openCommand = commands.at(-1) ?? [];
      return [...commands.slice(0, -1), [...openCommand, unresolvedWord]];
    },
    [[]],
  );

const gitOptionsWithValue: ReadonlySet<string> = new Set([
  "-c",
  "--config-env",
  "--exec-path",
  "--git-dir",
  "--namespace",
  "--super-prefix",
  "--work-tree",
]);

const scanGitOptions = (
  words: readonly string[],
  directories: readonly string[],
): Readonly<{ directories: readonly string[]; rest: readonly string[] }> => {
  const [leadingWord, followingWord, ...rest] = words;
  if (leadingWord === "-C" && followingWord !== undefined) {
    return scanGitOptions(rest, [...directories, followingWord]);
  }
  if (
    leadingWord !== undefined &&
    gitOptionsWithValue.has(leadingWord) &&
    followingWord !== undefined
  ) {
    return scanGitOptions(rest, directories);
  }
  if (leadingWord?.startsWith("-") === true) {
    return scanGitOptions(words.slice(1), directories);
  }
  return { directories, rest: words };
};

const addOptionsWithValue: ReadonlySet<string> = new Set(["-b", "-B", "--reason"]);

const addTargetOf = (words: readonly string[]): string | undefined => {
  const [leadingWord, followingWord, ...rest] = words;
  if (leadingWord === undefined) {
    return undefined;
  }
  if (leadingWord === "--") {
    return followingWord;
  }
  if (addOptionsWithValue.has(leadingWord)) {
    return followingWord === undefined ? undefined : addTargetOf(rest);
  }
  return leadingWord.startsWith("-") ? addTargetOf(words.slice(1)) : leadingWord;
};

const isAssignment = (word: string): boolean => /^[A-Za-z_]\w*=/u.test(word);

export type WorktreeAdd = Readonly<{
  directories: readonly string[];
  target: string | undefined;
}>;

const worktreeAddOf = (words: readonly string[]): WorktreeAdd | undefined => {
  const commandStart = words.findIndex((word) => !isAssignment(word));
  const [executable, ...afterExecutable] = commandStart < 0 ? [] : words.slice(commandStart);
  if (executable?.slice(executable.lastIndexOf("/") + 1) !== "git") {
    return undefined;
  }
  const scan = scanGitOptions(afterExecutable, []);
  const [subcommand, action, ...addWords] = scan.rest;
  if (subcommand !== "worktree" || action !== "add") {
    return undefined;
  }
  return { directories: scan.directories, target: addTargetOf(addWords) };
};

export const findWorktreeAdds = (commandLine: string): readonly WorktreeAdd[] =>
  simpleCommandsOf(commandLine).flatMap((words) => {
    const worktreeAdd = worktreeAddOf(words);
    return worktreeAdd === undefined ? [] : [worktreeAdd];
  });
