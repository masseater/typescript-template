interface ShellWords {
  readonly escaped: boolean;
  readonly quote: string | undefined;
  readonly segment: readonly string[];
  readonly segments: readonly (readonly string[])[];
  readonly word: string;
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

const packageManagers = new Set(["pnpm", "pnpx", "npm", "npx", "yarn", "yarnpkg", "bun", "bunx"]);
const launchers = new Set(["exec", "command", "env", "corepack"]);

function callsPackageManager(tokens: readonly string[]): boolean {
  const command = tokens.find(
    (word) => !launchers.has(word) && !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(word),
  );
  if (command === undefined) {
    return false;
  }
  return packageManagers.has(command.replace(/^.*\//u, "").replace(/\.cmd$/u, ""));
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
    return words(command).some((tokens) => callsPackageManager(tokens))
      ? [
          `${name}: パッケージマネージャーを直接呼ばず、script は vp run、node_modules のバイナリは vp exec、未導入のツールは vp dlx で実行してください: ${command}`,
        ]
      : [];
  });
}
