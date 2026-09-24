import { parse } from "shell-quote";

import { launchers, packageManagers, scriptPolicy } from "./script-policy-test-fixture.ts";

const segmentOperators = new Set(["&&", "||", ";", "|", "&", "|&", ";;"]);

interface QuoteState {
  readonly escaped: boolean;
  readonly quote: "'" | '"' | undefined;
}

const nextQuoteState = (state: QuoteState, character: string): QuoteState => {
  if (state.escaped) {
    return { ...state, escaped: false };
  }
  if (character === "\\" && state.quote !== "'") {
    return { ...state, escaped: true };
  }
  if (state.quote !== undefined) {
    return character === state.quote ? { ...state, quote: undefined } : state;
  }
  return character === "'" || character === '"' ? { ...state, quote: character } : state;
};

const assertBalancedShellQuotes = (command: string): void => {
  const end = Array.from(command).reduce(nextQuoteState, { escaped: false, quote: undefined });
  if (end.quote !== undefined || end.escaped) {
    throw new Error("Script has an unfinished shell quote or escape");
  }
};

const stringTokens = (tokens: readonly unknown[]): string[] => {
  return tokens.flatMap((token) => (typeof token === "string" ? [token] : []));
};

const separatesSegments = (token: unknown): boolean =>
  typeof token === "object" &&
  token !== null &&
  "op" in token &&
  typeof token.op === "string" &&
  segmentOperators.has(token.op);

const words = (command: string): readonly (readonly string[])[] => {
  assertBalancedShellQuotes(command);
  return command.split(/\n/u).flatMap((line) => {
    const tokens = parse(line, () => undefined);
    const segments: string[][] = [];
    let current: string[] = [];
    for (const token of tokens) {
      if (typeof token === "string") {
        current.push(token);
        continue;
      }
      if (separatesSegments(token) && current.length > 0) {
        segments.push(current);
        current = [];
      }
    }
    if (current.length > 0) {
      segments.push(current);
    }
    return segments;
  });
};

function binaryName(word: string): string {
  return word.replace(/^.*\//u, "").replace(/\.cmd$/u, "");
}

function leadingCommand(tokens: readonly string[]): number {
  return tokens.findIndex(
    (word) => !launchers.has(word) && !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(word),
  );
}

function callsPackageManager(tokens: readonly string[]): boolean {
  const index = leadingCommand(tokens);
  return index !== -1 && packageManagers.has(binaryName(tokens[index] ?? ""));
}

function callsDestructiveBinary(tokens: readonly string[]): boolean {
  return tokens.some((word) => scriptPolicy.destructiveBinaries.has(binaryName(word)));
}

function destructiveBinaryMessage(name: string, command: string): string {
  const binary = stringTokens(parse(command, () => undefined))
    .map(binaryName)
    .find((word) => scriptPolicy.destructiveBinaries.has(word));
  const guidance =
    binary === undefined
      ? ""
      : (scriptPolicy.destructiveBinaryGuidance[
          binary as keyof typeof scriptPolicy.destructiveBinaryGuidance
        ] ?? "");
  return `${name}: alchemy の CLI は unsafe nuke と destroy でアカウント全体を消せるため直接呼べません。${guidance}: ${command}`;
}

function runsFileWithNode(tokens: readonly string[]): boolean {
  const index = leadingCommand(tokens);
  return (
    index !== -1 &&
    binaryName(tokens[index] ?? "") === "node" &&
    tokens.slice(index + 1).some((word) => !word.startsWith("-"))
  );
}

function commandViolations(name: string, command: string): string[] {
  const segments = words(command);
  return [
    ...(segments.some((tokens) => runsFileWithNode(tokens))
      ? [
          `${name}: node でファイルを直接実行せず、パッケージの bin か vp run で実行してください: ${command}`,
        ]
      : []),
    ...(segments.some((tokens) => callsPackageManager(tokens))
      ? [
          `${name}: パッケージマネージャーを直接呼ばず、script は vp run、node_modules のバイナリは vp exec、未導入のツールは vp dlx で実行してください: ${command}`,
        ]
      : []),
    ...(segments.some((tokens) => callsDestructiveBinary(tokens))
      ? [destructiveBinaryMessage(name, command)]
      : []),
  ];
}

function scriptViolations(manifest: unknown): string[] {
  if (typeof manifest !== "object" || manifest === null || !("scripts" in manifest)) {
    return [];
  }
  const scripts: unknown = manifest.scripts;
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) {
    throw new Error("package.json scripts must be an object");
  }
  return Object.entries(scripts).flatMap(([entryName, command]: readonly [string, unknown]) => {
    if (typeof command !== "string") {
      throw new TypeError(`Script ${entryName} must be a string`);
    }
    return commandViolations(entryName, command);
  });
}

type Command = string | readonly string[];
type Task = Command | { readonly command: Command };

function taskViolations(tasks: Readonly<Record<string, Task>>): string[] {
  return Object.entries(tasks).flatMap(([name, task]: readonly [string, Task]) => {
    const command = typeof task === "object" && "command" in task ? task.command : task;
    return [command].flat().flatMap((entry: string) => commandViolations(name, entry));
  });
}

export { scriptViolations, taskViolations };
export type { Command, Task };
