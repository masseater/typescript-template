import { NodeServices } from "@effect/platform-node";
import { Cause, Console, Effect, Exit, Layer, Ref, Stdio } from "effect";

import type { Command } from "effect/unstable/cli";

type RecordedRun = {
  readonly diagnostics: readonly string[];
  readonly printed: readonly string[];
  readonly rejection: string | undefined;
};

const rejectionOf = (exit: Exit.Exit<unknown, unknown>): string | undefined => {
  if (Exit.isSuccess(exit)) return undefined;
  const squashed = Cause.squash(exit.cause);
  return squashed instanceof Error
    ? `${String(Reflect.get(squashed, "_tag"))}: ${squashed.message}`
    : String(squashed);
};

const subcommandsOf = (command: Command.Command.Any): readonly Command.Command.Any[] =>
  command.subcommands.flatMap((group) => group.commands);

const subcommandNamesOf = (
  command: Command.Command.Any,
  ...path: readonly string[]
): readonly string[] => {
  const nested = path.reduce<Command.Command.Any | undefined>(
    (current, name) =>
      current === undefined
        ? undefined
        : subcommandsOf(current).find((subcommand) => subcommand.name === name),
    command,
  );
  return nested === undefined ? [] : subcommandsOf(nested).map((subcommand) => subcommand.name);
};

const recordedRun = (input: {
  readonly args: readonly string[];
  readonly program: Effect.Effect<void, unknown, NodeServices.NodeServices>;
}): Promise<RecordedRun> =>
  Effect.runPromise(
    Effect.gen(function* recordRun() {
      const services = yield* Effect.context();
      const written = yield* Ref.make<readonly { stream: string; text: string }[]>([]);
      const recordedTo =
        (stream: string) =>
        (...lines: readonly unknown[]): void => {
          Effect.runSyncWith(services)(
            Ref.update(written, (earlier) => [...earlier, { stream, text: lines.join(" ") }]),
          );
        };
      const recording: Console.Console = {
        ...globalThis.console,
        error: recordedTo("stderr"),
        log: recordedTo("stdout"),
      };
      const exit = yield* input.program.pipe(
        Effect.provideService(Console.Console, recording),
        Effect.provide(
          Layer.merge(NodeServices.layer, Stdio.layerTest({ args: Effect.succeed(input.args) })),
        ),
        Effect.exit,
      );
      const lines = yield* Ref.get(written);
      const textOf = (stream: string): readonly string[] =>
        lines.filter((line) => line.stream === stream).map((line) => line.text);
      return {
        diagnostics: textOf("stderr"),
        printed: textOf("stdout"),
        rejection: rejectionOf(exit),
      };
    }),
  );

const recordedRequests = async <Request>(input: {
  readonly args: readonly string[];
  readonly program: (
    received: (request: Request) => Effect.Effect<void>,
  ) => Effect.Effect<void, unknown, NodeServices.NodeServices>;
}): Promise<{ readonly requests: readonly Request[]; readonly run: RecordedRun }> => {
  const requests: Request[] = [];
  const run = await recordedRun({
    args: input.args,
    program: input.program((request) =>
      Effect.sync(() => {
        requests.push(request);
      }),
    ),
  });
  return { requests, run };
};

export { recordedRequests, recordedRun, subcommandNamesOf };
export type { RecordedRun };
