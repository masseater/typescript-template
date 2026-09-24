import { NodeServices } from "@effect/platform-node";
import { Cause, Console, Effect, Exit, Layer, Ref, Stdio } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { describe, expect, test } from "vite-plus/test";

import { runCommand } from "./command.ts";

const reportCommand = Command.make("report", { service: Flag.String("service") }, ({ service }) =>
  Console.log(JSON.stringify({ service })),
);

describe.for([
  {
    args: ["--service", "logs"],
    rejectedWith: undefined,
    stderrWritten: false,
    stdout: ['{"service":"logs"}'],
  },
  {
    args: ["--service", "logs", "--bogus"],
    rejectedWith: "UnrecognizedOption: Unrecognized flag: --bogus in command report",
    stderrWritten: true,
    stdout: [],
  },
  {
    args: [],
    rejectedWith: "MissingOption: Missing required flag: --service",
    stderrWritten: true,
    stdout: [],
  },
])(
  "a command run through runCommand with $args",
  ({ args, rejectedWith, stderrWritten, stdout }) => {
    const it = test
      .extend("commandRun", () =>
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
            const exit = yield* reportCommand.pipe(
              runCommand({ version: "0.0.0" }),
              Effect.provideService(Console.Console, recording),
              Effect.provide(
                Layer.merge(NodeServices.layer, Stdio.layerTest({ args: Effect.succeed(args) })),
              ),
              Effect.exit,
            );
            return { exit, lines: yield* Ref.get(written) };
          }),
        ))
      .extend("printedLines", ({ commandRun }) =>
        commandRun.lines.filter((line) => line.stream === "stdout").map((line) => line.text),
      )
      .extend("diagnosticsWritten", ({ commandRun }) =>
        commandRun.lines.some((line) => line.stream === "stderr"),
      )
      .extend("rejection", ({ commandRun }) => {
        const squashed = Exit.isFailure(commandRun.exit)
          ? Cause.squash(commandRun.exit.cause)
          : undefined;
        return squashed instanceof Error
          ? `${String(Reflect.get(squashed, "_tag"))}: ${squashed.message}`
          : squashed;
      });

    it("prints only the handler output on stdout", ({ printedLines }) => {
      expect(printedLines).toStrictEqual(stdout);
    });

    it("writes framework output to stderr only when parsing fails", ({ diagnosticsWritten }) => {
      expect(diagnosticsWritten).toBe(stderrWritten);
    });

    it("fails with the parse error instead of a help request", ({ rejection }) => {
      expect(rejection).toBe(rejectedWith);
    });
  },
);
