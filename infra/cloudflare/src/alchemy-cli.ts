import { env as processEnvironment } from "node:process";
import { fileURLToPath } from "node:url";

import { cliStderr, cliStdout } from "@repo/cli";
import { Effect, PlatformError, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

import { layer } from "./platform.ts";
import { FAILED_EXIT_CODE, redact } from "./secrets.ts";

import type { WriteTarget } from "@repo/cli";
import type { Confidential } from "./secrets.ts";

class AlchemyFailure extends Schema.TaggedError<AlchemyFailure>()("AlchemyFailure", {
  code: Schema.Literals(["alchemy_command_failed", "alchemy_command_rejected"]),
}) {}

const AllowedAlchemyCommand = Schema.Tuple([
  Schema.Literal("provider"),
  Schema.Literal("cloudflare"),
  Schema.Literal("bootstrap"),
  Schema.Literal("--env-file"),
  Schema.String,
]);

type AlchemyCommand = typeof AllowedAlchemyCommand.Type;

const isAlchemyCommand = Schema.is(AllowedAlchemyCommand);

const alchemyBinary = fileURLToPath(new URL("../node_modules/.bin/alchemy", import.meta.url));

function forward(
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  target: WriteTarget,
  confidential: readonly Confidential[],
): Effect.Effect<void> {
  return Stream.decodeText(stream).pipe(
    Stream.splitLines,
    Stream.runForEach((line) =>
      Effect.sync(() => {
        target.write(`${redact(line, confidential)}\n`);
      }),
    ),
    Effect.ignore,
  );
}

function spawnAlchemy(
  args: AlchemyCommand,
  confidential: readonly Confidential[],
): Effect.Effect<number, AlchemyFailure> {
  return Effect.gen(function* runAlchemyChild() {
    const handle = yield* ChildProcess.make(alchemyBinary, [...args], {
      env: { ...processEnvironment, ALCHEMY_TELEMETRY_DISABLED: "1" },
      extendEnv: false,
      stdin: "ignore",
    }).pipe(Effect.mapError(() => new AlchemyFailure({ code: "alchemy_command_failed" })));
    yield* Effect.all(
      [
        forward(handle.stdout, cliStdout, confidential),
        forward(handle.stderr, cliStderr, confidential),
      ],
      { concurrency: "unbounded" },
    );
    return yield* handle.exitCode.pipe(
      Effect.map((code) => Number(code)),
      Effect.orElseSucceed(() => FAILED_EXIT_CODE),
    );
  }).pipe(Effect.scoped, Effect.provide(layer));
}

function runAlchemy(
  command: readonly string[],
  confidential: readonly Confidential[],
): Effect.Effect<number, AlchemyFailure> {
  return isAlchemyCommand(command)
    ? spawnAlchemy(command, confidential)
    : new AlchemyFailure({ code: "alchemy_command_rejected" });
}

export { AlchemyFailure, runAlchemy };
export type { AlchemyCommand };
