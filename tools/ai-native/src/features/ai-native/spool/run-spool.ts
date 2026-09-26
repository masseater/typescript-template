import { optionalSetting } from "@repo/ai-native-telemetry/optional-setting";
import { Effect, Result, Stream, type FileSystem, type PlatformError, type Scope } from "effect";

import { childEndOf, type ChildEnd } from "../child-process.ts";
import {
  filesystem,
  makeDirectory,
  nativeFailure,
  onDisk,
  paths,
  randomHex,
  removePath,
  spawner,
  wallClockDate,
} from "../host.ts";
import { measureCommand, recordCommandRecord } from "../telemetry/command-telemetry.ts";
import { exitCodeOf, startFailureSummary } from "./child-outcome.ts";
import { formatElapsed } from "./format-elapsed.ts";
import { defaultSpoolRoot } from "./log-destination.ts";
import { parseCommand, type Command } from "./parse-command.ts";
import { recordNameOf } from "./record-name.ts";
import { isPassthroughSignalled, passThrough, spoolChildCommand } from "./run-passthrough.ts";
import { stripEscapes } from "./strip-escapes.ts";

const defaultIsPassthrough = (): boolean => isPassthroughSignalled(optionalSetting("CI"));

export type SpoolDeps = {
  stdout: { write: (part: string) => unknown };
  stderr: { write: (part: string) => unknown };
  now?: () => Date;
  monotonicNow?: () => number;
  uniqueSuffix?: () => string;
  isPassthrough?: () => boolean;
  spoolRoot?: () => string;
};

type ResolvedDeps = {
  stdout: { write: (part: string) => unknown };
  stderr: { write: (part: string) => unknown };
  now: () => Date;
  monotonicNow: () => number;
  uniqueSuffix: () => string;
  spoolRoot: Effect.Effect<string, Error>;
};

const resolveDeps = (deps: SpoolDeps): ResolvedDeps => ({
  stdout: deps.stdout,
  stderr: deps.stderr,
  now: deps.now ?? wallClockDate,
  monotonicNow: deps.monotonicNow ?? (() => performance.now()),
  uniqueSuffix: deps.uniqueSuffix ?? (() => randomHex(4)),
  spoolRoot: deps.spoolRoot === undefined ? defaultSpoolRoot() : Effect.sync(deps.spoolRoot),
});

type Recording = {
  readonly bytes: number;
  readonly newlines: number;
  readonly endsWithNewline: boolean;
  readonly tailParts: readonly Uint8Array[];
  readonly tailLength: number;
  readonly failure: Error | undefined;
};

const freshRecording = (failure: Error | undefined): Recording => ({
  bytes: 0,
  newlines: 0,
  endsWithNewline: true,
  tailParts: [],
  tailLength: 0,
  failure,
});

const tailLimit = 32768;

const trimmedTail = (
  tailParts: readonly Uint8Array[],
  tailLength: number,
): Pick<Recording, "tailParts" | "tailLength"> => {
  const [oldest, ...newer] = tailParts;
  return oldest !== undefined && newer.length > 0 && tailLength - oldest.length >= tailLimit
    ? trimmedTail(newer, tailLength - oldest.length)
    : { tailParts, tailLength };
};

const observed = (recording: Recording, part: Uint8Array): Recording => ({
  ...recording,
  bytes: recording.bytes + part.length,
  newlines:
    recording.newlines + part.reduce((counted, byte) => (byte === 0x0a ? counted + 1 : counted), 0),
  endsWithNewline: part.at(-1) === 0x0a,
  ...trimmedTail([...recording.tailParts, part], recording.tailLength + part.length),
});

const recordPart =
  (file: FileSystem.File) =>
  (recording: Recording, part: Uint8Array): Effect.Effect<Recording> =>
    recording.failure === undefined
      ? file.writeAll(part).pipe(
          Effect.match({
            onFailure: (writeFailure) => ({
              ...observed(recording, part),
              failure: nativeFailure(writeFailure),
            }),
            onSuccess: () => observed(recording, part),
          }),
        )
      : Effect.succeed(observed(recording, part));

const recordArrival =
  (file: FileSystem.File) =>
  (
    recording: Recording,
    arrival: Result.Result<Uint8Array, PlatformError.PlatformError>,
  ): Effect.Effect<Recording> =>
    Result.isSuccess(arrival)
      ? recordPart(file)(recording, arrival.success)
      : Effect.succeed({
          ...recording,
          failure: recording.failure ?? nativeFailure(arrival.failure),
        });

const sizeSummaryOf = (recording: Recording): { bytes: number; lineCount: number } => ({
  bytes: recording.bytes,
  lineCount: recording.newlines + (recording.endsWithNewline ? 0 : 1),
});

const excerptOf = (tail: Buffer): string => {
  const lines = tail.toString().split("\n");
  const closedLines = lines.at(-1) === "" ? lines.slice(0, -1) : lines;
  return closedLines
    .slice(-20)
    .map((line) => `${line}\n`)
    .join("");
};

const recordedExcerpt = (recording: Recording): string =>
  excerptOf(Buffer.concat(recording.tailParts));

const recordFailureSummary = (
  commandLine: string,
  written: { filePath: string; reason: unknown },
): string =>
  `spool: command: ${commandLine}\nspool: error: cannot record to ${written.filePath}: ${String(written.reason)}\n`;

const reportCompletion = (input: {
  deps: ResolvedDeps;
  commandLine: string;
  filePath: string;
  recording: Recording;
  end: ChildEnd;
  elapsed: string;
}): number => {
  if (input.recording.failure !== undefined) {
    input.deps.stderr.write(
      recordFailureSummary(input.commandLine, {
        filePath: input.filePath,
        reason: input.recording.failure,
      }),
    );
    return 1;
  }
  const exitCode = exitCodeOf(input.end);
  const { bytes, lineCount } = sizeSummaryOf(input.recording);
  input.deps.stdout.write(
    `spool: command: ${input.commandLine}\nspool: log: ${input.filePath} (${bytes} bytes, ${lineCount} lines)\nspool: exit: ${exitCode} (${input.elapsed})\n`,
  );
  recordCommandRecord({
    commandLine: input.commandLine,
    exitCode,
    filePath: input.filePath,
    bytes,
    lineCount,
    excerpt: recordedExcerpt(input.recording),
  });
  if (exitCode !== 0) {
    input.deps.stdout.write(recordedExcerpt(input.recording));
  }
  return exitCode;
};

type RecordedRun =
  | { readonly kind: "completed"; readonly exitCode: number }
  | { readonly kind: "start-failure"; readonly spawnError: Error };

const recordRun = (input: {
  command: Command;
  deps: ResolvedDeps;
  filePath: string;
  file: FileSystem.File;
}): Effect.Effect<RecordedRun, never, Scope.Scope> =>
  Effect.gen(function* recordCommand() {
    const headerFailure = yield* input.file
      .writeAll(new TextEncoder().encode(`${input.command.join(" ")}\n\n`))
      .pipe(Effect.match({ onFailure: nativeFailure, onSuccess: () => undefined }));
    const startedAt = input.deps.monotonicNow();
    const handle = yield* spawner.spawn(spoolChildCommand(input.command, "pipe"));
    const recording = yield* Stream.merge(
      Stream.result(stripEscapes(handle.stdout)),
      Stream.result(stripEscapes(handle.stderr)),
    ).pipe(Stream.runFoldEffect(() => freshRecording(headerFailure), recordArrival(input.file)));
    const end = yield* childEndOf(handle);
    return {
      kind: "completed" as const,
      exitCode: reportCompletion({
        deps: input.deps,
        commandLine: input.command.join(" "),
        filePath: input.filePath,
        recording,
        end,
        elapsed: formatElapsed(input.deps.monotonicNow() - startedAt),
      }),
    };
  }).pipe(
    Effect.match({
      onFailure: (spawnFailure): RecordedRun => ({
        kind: "start-failure",
        spawnError: nativeFailure(spawnFailure),
      }),
      onSuccess: (completed): RecordedRun => completed,
    }),
  );

const openRecordFile = (
  rootDir: string,
  filePath: string,
): Effect.Effect<FileSystem.File, Error, Scope.Scope> =>
  makeDirectory(rootDir).pipe(Effect.andThen(onDisk(filesystem.open(filePath, { flag: "a" }))));

const recordedRunOf = (input: {
  command: Command;
  deps: ResolvedDeps;
  filePath: string;
  rootDir: string;
}): Effect.Effect<RecordedRun | { readonly kind: "unrecordable"; readonly reason: Error }> =>
  Effect.scoped(
    openRecordFile(input.rootDir, input.filePath).pipe(
      Effect.matchEffect({
        onFailure: (reason) => Effect.succeed({ kind: "unrecordable" as const, reason }),
        onSuccess: (file) => recordRun({ ...input, file }),
      }),
    ),
  );

const runEscapedUnder = (input: {
  command: Command;
  deps: ResolvedDeps;
  rootDir: string;
}): Effect.Effect<number> =>
  Effect.gen(function* runRecorded() {
    const { command, deps, rootDir } = input;
    const filePath = paths.join(
      rootDir,
      recordNameOf({
        stampedInstant: deps.now(),
        command,
        uniqueSuffix: deps.uniqueSuffix(),
      }),
    );
    const recordedRun = yield* recordedRunOf({ command, deps, filePath, rootDir });
    switch (recordedRun.kind) {
      case "completed":
        return recordedRun.exitCode;
      case "unrecordable":
        deps.stderr.write(
          recordFailureSummary(command.join(" "), { filePath, reason: recordedRun.reason }),
        );
        return 1;
      case "start-failure":
        yield* Effect.ignore(removePath(filePath));
        deps.stderr.write(startFailureSummary(command.join(" "), recordedRun.spawnError));
        return 127;
    }
  });

const runEscaped = (command: Command, deps: ResolvedDeps): Effect.Effect<number> =>
  deps.spoolRoot.pipe(
    Effect.matchEffect({
      onFailure: (reason) =>
        Effect.sync(() => {
          deps.stderr.write(
            recordFailureSummary(command.join(" "), { filePath: ".spool", reason }),
          );
          return 1;
        }),
      onSuccess: (rootDir) => runEscapedUnder({ command, deps, rootDir }),
    }),
  );

const usageText = [
  "usage: spool -- <command> [args...]",
  "",
  "Runs the command with its stdout and stderr recorded to a single log file",
  "under the repository's .spool directory, and prints a fixed-size summary",
  "instead of the output. Terminal escape sequences are removed from the record.",
  "On a non-zero exit the summary is followed by the last 20 recorded lines.",
  'When the CI environment variable is set to a non-empty value other than "false",',
  "the command's stdio passes through untouched and no log file is created.",
  "",
  "exit codes: the command's own code (128+signal when killed by a signal),",
  "127 when the command cannot start, 1 when recording fails, 2 on usage errors",
].join("\n");

export const runSpool = (argv: string[], deps: SpoolDeps): Promise<number> => {
  const command = parseCommand(argv);
  if (command === undefined) {
    deps.stderr.write(`${usageText}\n`);
    return Promise.resolve(2);
  }
  const resolved = resolveDeps(deps);
  return measureCommand({
    command,
    run: () =>
      Effect.runPromise(
        (deps.isPassthrough ?? defaultIsPassthrough)()
          ? passThrough(command, resolved)
          : runEscaped(command, resolved),
      ),
  });
};
