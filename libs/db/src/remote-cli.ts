import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { RemoteFailure } from "./remote-input.ts";

const inputInvalid = () => new RemoteFailure({ code: "REMOTE_INPUT_INVALID" });

const readInput = Effect.tryPromise({
  try: async () => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of process.stdin) {
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

const report = (code: string) =>
  Effect.sync(() => {
    console.error(JSON.stringify({ ok: false, event: "database.remote_failed", code }));
    process.exitCode = 1;
  });

NodeRuntime.runMain(
  readInput.pipe(
    Effect.flatMap((input) => runRemoteDatabaseCommand(process.argv.slice(2), input)),
    Effect.flatMap((output) => Effect.sync(() => console.info(JSON.stringify(output)))),
    Effect.catchTag("RemoteFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("REMOTE_DATABASE_FAILED")),
  ),
  { disableErrorReporting: true },
);
