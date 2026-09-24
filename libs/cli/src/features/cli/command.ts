import { Console, Effect } from "effect";
import { CliError, Command } from "effect/unstable/cli";

const diagnosticConsole = (terminal: Readonly<Console.Console>): Console.Console =>
  new Proxy(terminal, {
    get: (wrapped, member): unknown =>
      Reflect.get(wrapped, member === "log" || member === "info" ? "error" : member),
  });

const isParseFailure = (failure: unknown): failure is CliError.ShowHelp =>
  CliError.isCliError(failure) && failure._tag === "ShowHelp" && failure.errors.length > 0;

const runCommand =
  (config: {
    readonly version: string;
    readonly renderErrors?: boolean;
  }): (<Name extends string, Input, E, R, ContextInput>(
    command: Command.Command<Name, Input, ContextInput, E, R>,
  ) => Effect.Effect<void, E | CliError.CliError, R | Command.Environment>) =>
  (command) =>
    Console.consoleWith((terminal) =>
      Command.run(config)(Command.provideSync(command, Console.Console, terminal)).pipe(
        Effect.provideService(Console.Console, diagnosticConsole(terminal)),
        Effect.catchIf(isParseFailure, (help) => Effect.fail(help.errors[0] ?? help)),
      ),
    );

export { runCommand };
