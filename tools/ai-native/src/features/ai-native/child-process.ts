import { Effect, Stream, type PlatformError } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/unstable/process";

import { nativeFailure, spawner } from "./host.ts";

type CapturedExit = {
  readonly error?: Error;
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

type CapturedLaunch = {
  readonly executable: string;
  readonly handed?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly input?: string;
};

const capturedCommand = (launch: CapturedLaunch): ChildProcess.Command =>
  ChildProcess.make(launch.executable, [...(launch.handed ?? [])], {
    ...(launch.cwd === undefined ? {} : { cwd: launch.cwd }),
    ...(launch.env === undefined ? {} : { env: launch.env }),
    detached: false,
    stdin:
      launch.input === undefined ? "ignore" : Stream.make(new TextEncoder().encode(launch.input)),
  });

const printedText = (
  printed: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
): Effect.Effect<string, PlatformError.PlatformError> =>
  Stream.mkString(Stream.decodeText(printed));

const SIGNAL_SPELLING = /'(SIG[A-Z0-9]+)'/u;

const signalOf = (failure: PlatformError.PlatformError): NodeJS.Signals | null =>
  (SIGNAL_SPELLING.exec(nativeFailure(failure).message)?.[1] as NodeJS.Signals | undefined) ?? null;

type ChildEnd = { readonly code: number | null; readonly signal: NodeJS.Signals | null };

const childEndOf = (handle: ChildProcessSpawner.ChildProcessHandle): Effect.Effect<ChildEnd> =>
  handle.exitCode.pipe(
    Effect.match({
      onFailure: (failure): ChildEnd => ({ code: null, signal: signalOf(failure) }),
      onSuccess: (code): ChildEnd => ({ code: Number(code), signal: null }),
    }),
  );

const runCaptured = (launch: CapturedLaunch): Effect.Effect<CapturedExit> =>
  Effect.scoped(
    Effect.gen(function* captureChild() {
      const handle = yield* spawner.spawn(capturedCommand(launch));
      const [stdout, stderr] = yield* Effect.all(
        [printedText(handle.stdout), printedText(handle.stderr)],
        { concurrency: "unbounded" },
      );
      const end = yield* childEndOf(handle);
      return { status: end.code, stderr, stdout };
    }),
  ).pipe(
    Effect.match({
      onFailure: (failure): CapturedExit => ({
        error: nativeFailure(failure),
        status: null,
        stderr: "",
        stdout: "",
      }),
      onSuccess: (captured): CapturedExit => captured,
    }),
  );

export { childEndOf, runCaptured };
export type { ChildEnd };
