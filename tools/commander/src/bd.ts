import { Effect, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

class BdFailure extends Schema.TaggedError<BdFailure>()("BdFailure", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["ledger_missing", "process_failed", "output_invalid", "rejected"]),
}) {}

interface Ledger {
  readonly actor: string;
  readonly directory: string;
}

type Decodable = Schema.Top & { readonly DecodingServices: never };

const Rejection = Schema.fromJsonString(Schema.Struct({ error: Schema.String }));
const ledgerMissing = "no_beads_directory";

function rejection(stdout: string): Effect.Effect<BdFailure> {
  return Schema.decodeUnknownEffect(Rejection)(stdout).pipe(
    Effect.map(
      ({ error }) =>
        new BdFailure({ reason: error === ledgerMissing ? "ledger_missing" : "rejected" }),
    ),
    Effect.orElseSucceed(() => new BdFailure({ reason: "process_failed" })),
  );
}

function run(
  ledger: Ledger,
  args: readonly string[],
): Effect.Effect<
  { readonly exitCode: number; readonly stdout: string },
  BdFailure,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const command = ChildProcess.make("bd", [...args], {
    cwd: ledger.directory,
    env: { BEADS_ACTOR: ledger.actor },
    extendEnv: true,
    stderr: "ignore",
    stdin: "ignore",
  });
  return Effect.gen(function* spawned() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(command);
    const stdout = yield* Stream.mkString(Stream.decodeText(handle.stdout));
    const exitCode = yield* handle.exitCode;
    return { exitCode, stdout };
  }).pipe(
    Effect.scoped,
    Effect.mapError((cause) => new BdFailure({ cause, reason: "process_failed" })),
  );
}

function bdQuiet(
  ledger: Ledger,
  args: readonly string[],
): Effect.Effect<void, BdFailure, ChildProcessSpawner.ChildProcessSpawner> {
  return run(ledger, ["--quiet", ...args]).pipe(
    Effect.flatMap(({ exitCode }) =>
      exitCode === 0 ? Effect.void : Effect.fail(new BdFailure({ reason: "process_failed" })),
    ),
  );
}

function bd<Output extends Decodable>(
  ledger: Ledger,
  args: readonly string[],
  output: Output,
): Effect.Effect<Output["Type"], BdFailure, ChildProcessSpawner.ChildProcessSpawner> {
  return run(ledger, ["--json", ...args]).pipe(
    Effect.flatMap(({ exitCode, stdout }) =>
      exitCode === 0
        ? Schema.decodeUnknownEffect(Schema.fromJsonString(output))(stdout).pipe(
            Effect.mapError((cause) => new BdFailure({ cause, reason: "output_invalid" })),
          )
        : rejection(stdout).pipe(Effect.flatMap((failure) => Effect.fail(failure))),
    ),
  );
}

export { BdFailure, bd, bdQuiet };
export type { Ledger };
