import { Console, Effect } from "effect";
import { CliError, Command } from "effect/unstable/cli";

const diagnosticConsole = (output: Console.Console): Console.Console => ({
  ...output,
  info: (...lines) => output.error(...lines),
  log: (...lines) => output.error(...lines),
});

const parseFailure = (error: unknown): error is CliError.ShowHelp =>
  CliError.isCliError(error) && error._tag === "ShowHelp" && error.errors.length > 0;

const runCommand =
  (config: { readonly version: string; readonly renderErrors?: boolean }) =>
  <Name extends string, Input, E, R, ContextInput>(
    command: Command.Command<Name, Input, ContextInput, E, R>,
  ): Effect.Effect<void, E | CliError.CliError, R | Command.Environment> =>
    Console.consoleWith((output) =>
      Command.run(config)(Command.provideSync(command, Console.Console, output)).pipe(
        Effect.provideService(Console.Console, diagnosticConsole(output)),
        Effect.catchIf(parseFailure, (help) => Effect.fail(help.errors[0] ?? help)),
      ),
    );

export { runCommand };
