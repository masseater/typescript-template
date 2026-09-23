import { Effect, Stream, type PlatformError } from "effect";
import { ChildProcessSpawner, type ChildProcess } from "effect/unstable/process";

interface CapturedProcess {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

const textOf = (
  output: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
): Effect.Effect<string, PlatformError.PlatformError> => Stream.mkString(Stream.decodeText(output));

const capturedProcess = (
  command: ChildProcess.Command,
): Effect.Effect<
  CapturedProcess,
  PlatformError.PlatformError,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.scoped(
    Effect.gen(function* capturedProcess() {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [textOf(handle.stdout), textOf(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" },
      );
      return { exitCode: Number(exitCode), stderr, stdout };
    }),
  );

export { capturedProcess };
