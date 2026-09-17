interface ShellWords {
  readonly escaped: boolean;
  readonly quote: string | undefined;
  readonly segment: readonly string[];
  readonly segments: readonly (readonly string[])[];
  readonly word: string;
}

interface PnpmArguments {
  readonly command: string | undefined;
  readonly filtered: boolean;
  readonly uncertainOption: boolean;
}

function closeWord(state: ShellWords): ShellWords {
  return state.word === ""
    ? state
    : { ...state, segment: [...state.segment, state.word], word: "" };
}

function closeSegment(state: ShellWords): ShellWords {
  const closed = closeWord(state);
  return closed.segment.length === 0
    ? closed
    : { ...closed, segment: [], segments: [...closed.segments, closed.segment] };
}

function appendCharacter(state: ShellWords, character: string): ShellWords {
  return { ...state, word: state.word + character };
}

function readUnquoted(state: ShellWords, character: string): ShellWords {
  if (character === "'" || character === '"') {
    return { ...state, quote: character };
  }
  if (";&|\n".includes(character)) {
    return closeSegment(state);
  }
  if (/\s/u.test(character)) {
    return closeWord(state);
  }
  return appendCharacter(state, character);
}

function readCharacter(state: ShellWords, character: string): ShellWords {
  if (state.escaped) {
    const escaped = { ...state, escaped: false };
    return character === "\n" ? escaped : appendCharacter(escaped, character);
  }
  if (character === "\\" && state.quote !== "'") {
    return { ...state, escaped: true };
  }
  if (state.quote !== undefined) {
    return character === state.quote
      ? { ...state, quote: undefined }
      : appendCharacter(state, character);
  }
  return readUnquoted(state, character);
}

function words(command: string): readonly (readonly string[])[] {
  let state: ShellWords = {
    escaped: false,
    quote: undefined,
    segment: [],
    segments: [],
    word: "",
  };
  for (const character of command) {
    state = readCharacter(state, character);
  }
  if (state.quote !== undefined || state.escaped) {
    throw new Error("Script has an unfinished shell quote or escape");
  }
  return closeSegment(state).segments;
}

const valueOptions = new Set([
  "--filter",
  "--filter-prod",
  "-F",
  "--dir",
  "-C",
  "--workspace-concurrency",
  "--reporter",
  "--resume-from",
]);
const booleanOptions = new Set([
  "-r",
  "--recursive",
  "-w",
  "--workspace-root",
  "--if-present",
  "--parallel",
  "--stream",
  "--aggregate-output",
  "--silent",
  "-s",
  "--fail-if-no-match",
  "--no-bail",
  "--no-sort",
  "--reverse",
]);
const shortFilter = "-F";

function isFilter(value: string): boolean {
  return (
    value === "--filter" ||
    value === "--filter-prod" ||
    value === shortFilter ||
    value.startsWith("--filter=") ||
    value.startsWith("--filter-prod=") ||
    value.startsWith("-F=") ||
    (value.startsWith(shortFilter) && value.length > shortFilter.length)
  );
}

function withOption(summary: PnpmArguments, option: string): PnpmArguments {
  if (valueOptions.has(option)) {
    return summary;
  }
  const uncertain = !booleanOptions.has(option) && !isFilter(option) && !option.includes("=");
  return { ...summary, uncertainOption: summary.uncertainOption || uncertain };
}

function inspectArguments(args: readonly string[], summary: PnpmArguments): PnpmArguments {
  const [argument, ...rest] = args;
  if (argument === undefined || argument === "--") {
    return summary;
  }
  const next = { ...summary, filtered: summary.filtered || isFilter(argument) };
  if (argument.startsWith("-")) {
    return inspectArguments(
      valueOptions.has(argument) ? rest.slice(1) : rest,
      withOption(next, argument),
    );
  }
  if (next.command !== undefined) {
    return inspectArguments(rest, next);
  }
  const withCommand = { ...next, command: argument };
  return argument === "run" ? withCommand : inspectArguments(rest, withCommand);
}

function violatesRun(tokens: readonly string[]): boolean {
  const index = tokens.findIndex((word) => /(?:^|\/)pnpm(?:\.cmd)?$/u.test(word));
  if (index === -1) {
    return false;
  }
  if (
    tokens
      .slice(0, index)
      .some(
        (word) =>
          !["exec", "command", "env", "corepack"].includes(word) &&
          !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(word),
      )
  ) {
    return false;
  }
  const { command, filtered, uncertainOption } = inspectArguments(tokens.slice(index + 1), {
    command: undefined,
    filtered: false,
    uncertainOption: false,
  });
  return filtered && (command !== "run" || uncertainOption);
}

export function scriptViolations(manifest: unknown): string[] {
  if (typeof manifest !== "object" || manifest === null || !("scripts" in manifest)) {
    return [];
  }
  const scripts: unknown = manifest.scripts;
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) {
    throw new Error("package.json scripts must be an object");
  }
  return Object.entries(scripts).flatMap(([name, command]) => {
    if (typeof command !== "string") {
      throw new TypeError(`Script ${name} must be a string`);
    }
    return words(command).some((tokens) => violatesRun(tokens))
      ? [`${name}: pnpm --filter に続く workspace script は必ず run を明示してください: ${command}`]
      : [];
  });
}
