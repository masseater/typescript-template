import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Console, Effect, Layer, Stdio } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { runCommand } from "./command.ts";

const reportCommand = Command.make(
  "report",
  { target: Flag.String("target") },
  ({ target }) => Console.log(JSON.stringify({ target })),
);

const recordedRun = (args: readonly string[]) =>
  Effect.gen(function* recordRun() {
    const written: { stream: "stderr" | "stdout"; text: string }[] = [];
    const recording: Console.Console = {
      ...globalThis.console,
      error: (...lines) => {
        written.push({ stream: "stderr", text: lines.join(" ") });
      },
      log: (...lines) => {
        written.push({ stream: "stdout", text: lines.join(" ") });
      },
    };
    const exit = yield* reportCommand.pipe(
      runCommand({ version: "0.0.0" }),
      Effect.provideService(Console.Console, recording),
      Effect.provide(
        Layer.merge(NodeServices.layer, Stdio.layerTest({ args: Effect.succeed(args) })),
      ),
      Effect.exit,
    );
    return {
      exit,
      stdout: written.filter((line) => line.stream === "stdout").map((line) => line.text),
      stderr: written.filter((line) => line.stream === "stderr").map((line) => line.text),
    };
  });

describe("a command run through runCommand", () => {
  it.effect("keeps the handler output on stdout", () =>
    Effect.gen(function* validArguments() {
      const run = yield* recordedRun(["--target", "logs"]);
      assert.isTrue(run.exit._tag === "Success");
      assert.deepStrictEqual(run.stdout, ['{"target":"logs"}']);
    }),
  );

  it.effect("sends help to stderr and fails with the parse error when a flag is unknown", () =>
    Effect.gen(function* unknownFlag() {
      const run = yield* recordedRun(["--target", "logs", "--bogus"]);
      assert.deepStrictEqual(run.stdout, []);
      assert.isNotEmpty(run.stderr);
      assert.isTrue(run.exit._tag === "Failure");
      assert.include(String(run.exit), "--bogus");
      assert.notInclude(String(run.exit), "ShowHelp");
    }),
  );

  it.effect("fails with the missing flag instead of a help request", () =>
    Effect.gen(function* missingFlag() {
      const run = yield* recordedRun([]);
      assert.deepStrictEqual(run.stdout, []);
      assert.include(String(run.exit), "target");
      assert.notInclude(String(run.exit), "ShowHelp");
    }),
  );
});
