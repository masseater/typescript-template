import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { Effect, Schema } from "effect";

import { FAILED_EXIT_CODE, redact } from "./secrets.ts";

import type { Confidential } from "./secrets.ts";

class AlchemyFailure extends Schema.TaggedError<AlchemyFailure>()("AlchemyFailure", {
  code: Schema.Literal("alchemy_command_failed"),
}) {}

const alchemyBinary = fileURLToPath(new URL("../node_modules/.bin/alchemy", import.meta.url));

const forward = (
  stream: Readable | null,
  target: Readonly<{ write: (chunk: string) => unknown }>,
  confidential: readonly Confidential[],
): void => {
  createInterface({ input: stream ?? Readable.from([]) }).on("line", (line: string) => {
    target.write(`${redact(line, confidential)}\n`);
  });
};

const runAlchemy = (
  args: readonly string[],
  confidential: readonly Confidential[],
): Effect.Effect<number, AlchemyFailure> => {
  return Effect.callback<number, AlchemyFailure>((resume) => {
    const child = spawn(alchemyBinary, [...args], {
      env: { ...process.env, ALCHEMY_TELEMETRY_DISABLED: "1" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    forward(child.stdout, process.stdout, confidential);
    forward(child.stderr, process.stderr, confidential);
    child.on("error", () => {
      resume(Effect.fail(new AlchemyFailure({ code: "alchemy_command_failed" })));
    });
    child.on("exit", (code) => {
      resume(Effect.succeed(code ?? FAILED_EXIT_CODE));
    });
  });
};

export { AlchemyFailure, runAlchemy };
