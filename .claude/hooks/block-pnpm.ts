import { parseShell } from "@yarnpkg/parsers";
import type {
  Argument,
  ArgumentSegment,
  CommandChain,
  CommandLine,
  EnvSegment,
  ShellLine,
} from "@yarnpkg/parsers";
import { Array as Arr, Effect, Match, Option, Schema, String as Str, pipe } from "effect";

import { blockWhen, readHookInput, runHook } from "./env.ts";

type Frozen<Value> = { readonly [Key in keyof Value]: Frozen<Value[Key]> };
type Line = Frozen<ShellLine>;
type Argv = readonly string[];

const PreToolUseInput = Schema.Struct({
  tool_input: Schema.Struct({ command: Schema.optional(Schema.String) }),
});

const MESSAGE = Arr.join("\n")([
  "pnpm・pnpx・pn・pnx は直接実行しない。Vite+ の vp を使うこと。",
  "pnpm install → vp install、pnpm add → vp add、pnpm remove → vp remove",
  "pnpm exec → vp exec、pnpm dlx → vp dlx、pnpm run <script> → vp run <script>",
  "その他の pnpm サブコマンド → vp pm <subcommand>",
]);

const SHELL_SCRIPT_FLAG = "-c";
const PNPM_BINARIES = new Set(["pnpm", "pnpx", "pn", "pnx"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash"]);
const LAUNCHERS = new Set(["vp", "npm", "yarn", "bun"]);
const LAUNCHER_SUBCOMMANDS = new Set(["exec", "dlx", "x"]);
const WRAPPERS = new Set([
  "env",
  "sudo",
  "exec",
  "command",
  "nohup",
  "time",
  "nice",
  "timeout",
  "stdbuf",
  "builtin",
  "noglob",
  "setsid",
  "caffeinate",
  "npx",
  "bunx",
  "corepack",
  "do",
  "then",
  "else",
  "if",
  "elif",
  "while",
  "until",
  "!",
]);

const basename = (word: string): string => pipe(word, Str.replace(/^.*\//u, ""));

const isPnpm = (word: string): boolean => PNPM_BINARIES.has(basename(word));

const invocationRules: readonly ((name: string, args: Argv) => boolean)[] = [
  (name) => PNPM_BINARIES.has(name),
  (name, args) => WRAPPERS.has(name) && pipe(args, Arr.some(isPnpm)),
  (name, [subcommand = "", ...rest]) =>
    LAUNCHERS.has(name) && LAUNCHER_SUBCOMMANDS.has(subcommand) && pipe(rest, Arr.some(isPnpm)),
];

const invokesPnpm = ([head = "", ...args]: Argv): boolean =>
  pipe(
    invocationRules,
    Arr.some((rule) => rule(basename(head), args)),
  );

const parse = (script: string): Option.Option<Line> => Option.liftThrowable(parseShell)(script);

const textOf = (segments: Frozen<ArgumentSegment[]>): string =>
  pipe(
    segments,
    Arr.filter((segment) => segment.type === "text"),
    Arr.map((segment) => segment.text),
    Arr.join(""),
  );

const nestedLines = (segments: Frozen<ArgumentSegment[]>): Line[] =>
  pipe(
    segments,
    Arr.filter((segment) => segment.type === "shell"),
    Arr.map((segment) => segment.shell),
  );

const valuesOf = (args: Frozen<Argument[]>): Frozen<Extract<Argument, { type: "argument" }>>[] =>
  pipe(
    args,
    Arr.filter((arg) => arg.type === "argument"),
  );

const shellScript = ([head = "", ...args]: Argv): Option.Option<string> => {
  const [, script] = Arr.dropWhile(args, (word) => word !== SHELL_SCRIPT_FLAG);
  return Option.filter(Option.fromUndefinedOr(script), () => SHELLS.has(basename(head)));
};

const argvOf = (args: Frozen<Argument[]>): Argv =>
  pipe(
    valuesOf(args),
    Arr.map((arg) => textOf(arg.segments)),
  );

const linesInArgs = (args: readonly Frozen<Extract<Argument, { type: "argument" }>>[]): Line[] =>
  pipe(
    args,
    Arr.flatMap((arg) => nestedLines(arg.segments)),
  );

const linesInEnvs = (envs: Frozen<EnvSegment[]>): Line[] =>
  pipe(
    envs,
    Arr.flatMap((env) => linesInArgs(valuesOf(env.args))),
  );

const linesInCommand = (args: Frozen<Argument[]>, envs: Frozen<EnvSegment[]>): Line[] => [
  ...linesInArgs(valuesOf(args)),
  ...linesInEnvs(envs),
  ...Option.toArray(shellScript(argvOf(args)).pipe(Option.flatMap(parse))),
];

const linksOf = (chain: Frozen<CommandChain>): Frozen<CommandChain>[] => [
  chain,
  ...Option.fromUndefinedOr(chain.then).pipe(
    Option.map((then) => linksOf(then.chain)),
    Option.getOrElse(Arr.empty),
  ),
];

const chainsOf = (commandLine: Frozen<CommandLine>): Frozen<CommandChain>[] => [
  ...linksOf(commandLine.chain),
  ...Option.fromUndefinedOr(commandLine.then).pipe(
    Option.map((then) => chainsOf(then.line)),
    Option.getOrElse(Arr.empty),
  ),
];

const linesOfChain = Match.type<Frozen<CommandChain>>().pipe(
  Match.discriminatorsExhaustive("type")({
    subshell: (command): Line[] => [command.subshell],
    group: (command): Line[] => [command.group],
    envs: (command): Line[] => linesInEnvs(command.envs),
    command: (command): Line[] => linesInCommand(command.args, command.envs),
  }),
);

const simpleCommands = (line: Line): readonly Argv[] => {
  const chains = pipe(
    line,
    Arr.flatMap((entry) => chainsOf(entry.command)),
  );
  const direct = pipe(
    chains,
    Arr.filter((chain) => chain.type === "command"),
    Arr.map((chain) => argvOf(chain.args)),
  );
  const nested = pipe(
    chains,
    Arr.flatMap((chain) => linesOfChain(chain)),
    Arr.flatMap((inner) => simpleCommands(inner)),
  );
  return [...direct, ...nested];
};

runHook(
  Effect.gen(function* blockPnpm() {
    const input = yield* readHookInput(PreToolUseInput);
    const blocked = Option.exists(parse(input.tool_input.command ?? ""), (line) =>
      pipe(simpleCommands(line), Arr.some(invokesPnpm)),
    );
    yield* blockWhen(Arr.filter([MESSAGE], () => blocked));
  }),
);
