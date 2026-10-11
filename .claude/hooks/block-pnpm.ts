import { parseShell } from "@yarnpkg/parsers";
import type {
  Argument,
  ArgumentSegment,
  CommandChain,
  CommandLine,
  EnvSegment,
  ShellLine,
} from "@yarnpkg/parsers";
import { Array as Arr, Effect, Match, Option, Schema } from "effect";

import { blockWhen, readHookInput, runHook } from "./env.ts";

type Frozen<Value> = { readonly [Key in keyof Value]: Frozen<Value[Key]> };
type Line = Frozen<ShellLine>;
type Argv = readonly string[];

const PreToolUseInput = Schema.Struct({
  tool_input: Schema.Struct({ command: Schema.optional(Schema.String) }),
});

const MESSAGE = [
  "pnpm・pnpx・pn・pnx は直接実行しない。Vite+ の vp を使うこと。",
  "pnpm install → vp install、pnpm add → vp add、pnpm remove → vp remove",
  "pnpm exec → vp exec、pnpm dlx → vp dlx、pnpm run <script> → vp run <script>",
  "その他の pnpm サブコマンド → vp pm <subcommand>",
].join("\n");

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

const basename = (word: string): string => word.replace(/^.*\//u, "");

const isPnpm = (word: string): boolean => PNPM_BINARIES.has(basename(word));

const invocationRules: readonly ((name: string, args: Argv) => boolean)[] = [
  (name) => PNPM_BINARIES.has(name),
  (name, args) => WRAPPERS.has(name) && args.some((word) => isPnpm(word)),
  (name, [subcommand = "", ...rest]) =>
    LAUNCHERS.has(name) &&
    LAUNCHER_SUBCOMMANDS.has(subcommand) &&
    rest.some((word) => isPnpm(word)),
];

const invokesPnpm = ([head = "", ...args]: Argv): boolean =>
  invocationRules.some((rule) => rule(basename(head), args));

const parse = (script: string): Option.Option<Line> => Option.liftThrowable(parseShell)(script);

const textOf = (segments: Frozen<ArgumentSegment[]>): string =>
  segments
    .flatMap((segment) => {
      if (segment.type === "text") {
        return [segment.text];
      }
      return [];
    })
    .join("");

const nestedLines = (segments: Frozen<ArgumentSegment[]>): Line[] =>
  segments.flatMap((segment) => {
    if (segment.type === "shell") {
      return [segment.shell];
    }
    return [];
  });

const valuesOf = (args: Frozen<Argument[]>): Frozen<Extract<Argument, { type: "argument" }>>[] =>
  args.flatMap((arg) => {
    if (arg.type === "argument") {
      return [arg];
    }
    return [];
  });

const shellScript = ([head = "", ...args]: Argv): Option.Option<string> => {
  const [, script] = Arr.dropWhile(args, (word) => word !== SHELL_SCRIPT_FLAG);
  return Option.filter(Option.fromUndefinedOr(script), () => SHELLS.has(basename(head)));
};

const argvOf = (args: Frozen<Argument[]>): Argv =>
  valuesOf(args).map((arg) => textOf(arg.segments));

const linesInEnvs = (envs: Frozen<EnvSegment[]>): Line[] =>
  envs.flatMap((env) => env.args.flatMap((arg) => nestedLines(arg.segments)));

const linesInCommand = (args: Frozen<Argument[]>, envs: Frozen<EnvSegment[]>): Line[] => [
  ...valuesOf(args).flatMap((arg) => nestedLines(arg.segments)),
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

const argvsOfChain = Match.type<Frozen<CommandChain>>().pipe(
  Match.discriminatorsExhaustive("type")({
    subshell: (): Argv[] => [],
    group: (): Argv[] => [],
    envs: (): Argv[] => [],
    command: (command): Argv[] => [argvOf(command.args)],
  }),
);

const linesOfChain = Match.type<Frozen<CommandChain>>().pipe(
  Match.discriminatorsExhaustive("type")({
    subshell: (command): Line[] => [command.subshell],
    group: (command): Line[] => [command.group],
    envs: (command): Line[] => linesInEnvs(command.envs),
    command: (command): Line[] => linesInCommand(command.args, command.envs),
  }),
);

const simpleCommands = (line: Line): readonly Argv[] => {
  const chains = line.flatMap((entry) => chainsOf(entry.command));
  return [
    ...chains.flatMap((chain) => argvsOfChain(chain)),
    ...chains.flatMap((chain) => linesOfChain(chain)).flatMap((nested) => simpleCommands(nested)),
  ];
};

runHook(
  Effect.gen(function* blockPnpm() {
    const input = yield* readHookInput(PreToolUseInput);
    const blocked = Option.exists(parse(input.tool_input.command ?? ""), (line) =>
      simpleCommands(line).some((argv) => invokesPnpm(argv)),
    );
    yield* blockWhen({ reasons: Arr.filter([MESSAGE], () => blocked) });
  }),
);
