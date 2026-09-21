import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { Effect, Schema } from "effect";

import { FAILED_EXIT_CODE, redact } from "./secrets.ts";

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
  stream: Readable | null,
  target: Readonly<{ write: (chunk: string) => unknown }>,
  confidential: readonly Confidential[],
): void {
  createInterface({ input: stream ?? Readable.from([]) }).on("line", (line: string) => {
    target.write(`${redact(line, confidential)}\n`);
  });
}

function spawnAlchemy(
  args: AlchemyCommand,
  confidential: readonly Confidential[],
): Effect.Effect<number, AlchemyFailure> {
  return Effect.callback<number, AlchemyFailure>((resume) => {
    const child = spawn(alchemyBinary, [...args], {
      env: { ...process.env, ALCHEMY_TELEMETRY_DISABLED: "1" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    // oxlint-disable-next-line project/process-boundary -- the alchemy child process writes its stdout and stderr through this process, which is the boundary those streams cross
    forward(child.stdout, process.stdout, confidential);
    // oxlint-disable-next-line project/process-boundary -- the alchemy child process writes its stdout and stderr through this process, which is the boundary those streams cross
    forward(child.stderr, process.stderr, confidential);
    child.on("error", () => {
      resume(Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" })));
    });
    child.on("exit", (code) => {
      resume(Effect.succeed(code ?? FAILED_EXIT_CODE));
    });
  });
}

function runAlchemy(
  command: AlchemyCommand,
  confidential: readonly Confidential[],
): Effect.Effect<number, AlchemyFailure> {
  return isAlchemyCommand(command)
    ? spawnAlchemy(command, confidential)
    : Effect.fail(new AlchemyFailure({ code: "alchemy_command_rejected" }));
}

export { AlchemyFailure, runAlchemy };
export type { AlchemyCommand };
