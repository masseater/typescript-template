import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { RemoteFailure } from "./remote-input.ts";

const inputInvalid = () => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" });

const readInput = (stdin: Iterable<unknown> | AsyncIterable<unknown>) =>
  Effect.tryPromise({
    try: async () => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of stdin) {
        if (!Buffer.isBuffer(chunk)) return Promise.reject(inputInvalid());
        size += chunk.length;
        if (size > 16_384) return Promise.reject(inputInvalid());
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString("utf8");
    },
    catch: inputInvalid,
  }).pipe(
    Effect.flatMap((text) =>
      Effect.try({ try: (): unknown => JSON.parse(text), catch: inputInvalid }),
    ),
  );

const failed = (code: string) => ({
  code: 1 as const,
  output: "",
  error: JSON.stringify({ ok: false, event: "database.remote_failed", code }),
});

export const runRemoteCli = (
  args: readonly string[],
  stdin: Iterable<unknown> | AsyncIterable<unknown>,
) =>
  readInput(stdin).pipe(
    Effect.flatMap((input) => runRemoteDatabaseCommand(args, input)),
    Effect.map((output) => ({ code: 0 as const, output: JSON.stringify(output), error: "" })),
    Effect.catchTag("RemoteFailure", (failure) => Effect.succeed(failed(failure.code))),
    Effect.catchCause(() => Effect.succeed(failed("REMOTE_DATABASE_FAILED"))),
  );

if (import.meta.main)
  NodeRuntime.runMain(
    runRemoteCli(process.argv.slice(2), process.stdin).pipe(
      Effect.flatMap((result) =>
        Effect.sync(() => {
          if (result.output) console.info(result.output);
          if (result.error) console.error(result.error);
          process.exitCode = result.code;
        }),
      ),
    ),
    { disableErrorReporting: true },
  );
