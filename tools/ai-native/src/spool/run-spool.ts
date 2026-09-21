import { Effect } from "effect";

import { waitEmitterEvent } from "../emitter-wait.ts";
import {
  joinPath,
  makeDirectory,
  optionalSetting,
  randomHex,
  removePath,
  wallClockDate,
} from "../host.ts";
import { STREAM_EVENT } from "../node-event-names.ts";
import { openWriteStream, type FileWriteStream } from "../node-file-stream.ts";
import { spawnChild, type SpawnedChild } from "../node-spawn.ts";
import {
  childEnvironment,
  measureCommand,
  recordCommandRecord,
} from "../telemetry/command-telemetry.ts";
import {
  exitCodeOf,
  startFailureSummary,
  waitClose,
  waitSpawn,
  type ChildEnd,
} from "./child-outcome.ts";
import { formatElapsed } from "./format-elapsed.ts";
import { defaultSpoolRoot } from "./log-destination.ts";
import { parseCommand, type Command } from "./parse-command.ts";
import { recordNameOf } from "./record-name.ts";
import { isPassthroughSignalled, runPassthrough } from "./run-passthrough.ts";
import { createEscapeStripper } from "./strip-escapes.ts";

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
  spoolRoot: () => string;
};

const resolveDeps = (deps: SpoolDeps): ResolvedDeps => ({
  stdout: deps.stdout,
  stderr: deps.stderr,
  now: deps.now ?? wallClockDate,
  monotonicNow: deps.monotonicNow ?? (() => performance.now()),
  uniqueSuffix: deps.uniqueSuffix ?? (() => randomHex(4)),
  spoolRoot: deps.spoolRoot ?? defaultSpoolRoot,
});

const prepareRecordFile = (rootDir: string, filePath: string): FileWriteStream => {
  makeDirectory(rootDir);
  return openWriteStream(filePath);
};

const recordOpenFailure = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

const openRecordFile = (rootDir: string, filePath: string): Promise<FileWriteStream | Error> => {
  try {
    const stream = prepareRecordFile(rootDir, filePath);
    return Effect.runPromise(
      Effect.promise(() => waitEmitterEvent(stream, "open")).pipe(
        Effect.map(() => stream),
        Effect.match({
          onFailure: recordOpenFailure,
          onSuccess: (opened) => opened,
        }),
      ),
    );
  } catch (caught) {
    return Promise.resolve(recordOpenFailure(caught));
  }
};

const discardRecord = (input: {
  deps: ResolvedDeps;
  commandLine: string;
  filePath: string;
  fileStream: FileWriteStream;
  closed: Promise<ChildEnd>;
  spawnError: Error;
}): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* dropFailedRecord() {
      yield* Effect.promise(() => input.closed);
      input.fileStream.destroy();
      removePath(input.filePath);
      input.deps.stderr.write(startFailureSummary(input.commandLine, input.spawnError));
      return 127;
    }),
  );

const recordFailureSummary = (
  commandLine: string,
  written: { filePath: string; reason: unknown },
): string =>
  `spool: command: ${commandLine}\nspool: error: cannot record to ${written.filePath}: ${String(written.reason)}\n`;

const excerptOf = (tail: Buffer): string => {
  const lines = tail.toString().split("\n");
  const closedLines = lines.at(-1) === "" ? lines.slice(0, -1) : lines;
  return closedLines
    .slice(-20)
    .map((line) => `${line}\n`)
    .join("");
};

const tailLimit = 32768;

class SpoolRecording {
  private readonly fileStream: FileWriteStream;
  private readonly strippers: readonly [
    ReturnType<typeof createEscapeStripper>,
    ReturnType<typeof createEscapeStripper>,
  ];
  private failure: Error | undefined = undefined;
  private bytes = 0;
  private newlines = 0;
  private endsWithNewline = true;
  private tailParts: readonly Buffer[] = [];
  private tailLength = 0;

  constructor(fileStream: FileWriteStream) {
    this.fileStream = fileStream;
    this.strippers = [createEscapeStripper(), createEscapeStripper()];
    fileStream.on(STREAM_EVENT.failure, (streamError: Error) => {
      this.abort(streamError);
    });
    for (const stripper of this.strippers) {
      stripper.on?.(STREAM_EVENT.data, (part: Buffer | Error) => {
        if (part instanceof Error) {
          this.abort(part);
          return;
        }
        this.observe(part);
      });
    }
  }

  private abort(streamError: Error): void {
    this.failure = streamError;
    for (const stripper of this.strippers) {
      stripper.unpipe?.(this.fileStream);
      stripper.resume?.();
    }
  }

  private observe(part: Buffer): void {
    this.bytes += part.length;
    this.newlines += part.reduce((counted, byte) => (byte === 0x0a ? counted + 1 : counted), 0);
    this.endsWithNewline = part.at(-1) === 0x0a;
    this.tailParts = [...this.tailParts, part];
    this.tailLength += part.length;
    this.trimTail();
  }

  private trimTail(): void {
    while (
      this.tailParts.length > 1 &&
      this.tailLength - (this.tailParts[0] as Buffer).length >= tailLimit
    ) {
      this.tailLength -= (this.tailParts[0] as Buffer).length;
      this.tailParts = this.tailParts.slice(1);
    }
  }

  capture(input: { child: SpawnedChild; closed: Promise<ChildEnd> }): Promise<ChildEnd> {
    const [stdoutStripper, stderrStripper] = this.strippers;
    const fileStream = this.fileStream;
    const finishRecording = (): Promise<void> => this.finish();
    return Effect.runPromise(
      Effect.gen(function* captureChild() {
        input.child.stdout?.pipe(stdoutStripper).pipe(fileStream, { end: false });
        input.child.stderr?.pipe(stderrStripper).pipe(fileStream, { end: false });
        const [end] = yield* Effect.promise(() =>
          Promise.all([
            input.closed,
            waitEmitterEvent(stdoutStripper, "end"),
            waitEmitterEvent(stderrStripper, "end"),
          ]),
        );
        yield* Effect.promise(() => finishRecording());
        return end;
      }),
    );
  }

  private finish(): Promise<void> {
    if (this.failure !== undefined) {
      return Promise.resolve();
    }
    return Effect.runPromise(
      Effect.callback((resume) => {
        this.fileStream.end(() => {
          resume(Effect.void);
        });
      }),
    );
  }

  get failed(): boolean {
    return this.failure !== undefined;
  }

  get reason(): unknown {
    return this.failure;
  }

  get sizeSummary(): { bytes: number; lineCount: number } {
    return { bytes: this.bytes, lineCount: this.newlines + (this.endsWithNewline ? 0 : 1) };
  }

  excerpt(): string {
    return excerptOf(Buffer.concat(this.tailParts));
  }
}

const reportCompletion = (input: {
  deps: ResolvedDeps;
  commandLine: string;
  filePath: string;
  recording: SpoolRecording;
  end: ChildEnd;
  elapsed: string;
}): number => {
  if (input.recording.failed) {
    input.deps.stderr.write(
      recordFailureSummary(input.commandLine, {
        filePath: input.filePath,
        reason: input.recording.reason,
      }),
    );
    return 1;
  }
  const exitCode = exitCodeOf(input.end);
  const { bytes, lineCount } = input.recording.sizeSummary;
  input.deps.stdout.write(
    `spool: command: ${input.commandLine}\nspool: log: ${input.filePath} (${bytes} bytes, ${lineCount} lines)\nspool: exit: ${exitCode} (${input.elapsed})\n`,
  );
  recordCommandRecord({
    commandLine: input.commandLine,
    exitCode,
    filePath: input.filePath,
    bytes,
    lineCount,
    excerpt: input.recording.excerpt(),
  });
  if (exitCode !== 0) {
    input.deps.stdout.write(input.recording.excerpt());
  }
  return exitCode;
};

const spawnRecorded = (command: Command): SpawnedChild => {
  const environment = childEnvironment();
  return spawnChild({
    executable: command[0],
    handed: command.slice(1),
    spawnOptions:
      environment === undefined
        ? { stdio: ["inherit", "pipe", "pipe"] }
        : { stdio: ["inherit", "pipe", "pipe"], env: environment },
  });
};

const recordRun = (input: {
  command: Command;
  deps: ResolvedDeps;
  filePath: string;
  fileStream: FileWriteStream;
}): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* recordCommand() {
      const recording = new SpoolRecording(input.fileStream);
      input.fileStream.write(`${input.command.join(" ")}\n\n`);
      const startedAt = input.deps.monotonicNow();
      const child = spawnRecorded(input.command);
      const closed = waitClose(child);
      const spawnError = yield* Effect.promise(() => waitSpawn(child));
      if (spawnError !== null) {
        return yield* Effect.promise(() =>
          discardRecord({
            deps: input.deps,
            commandLine: input.command.join(" "),
            filePath: input.filePath,
            fileStream: input.fileStream,
            closed,
            spawnError,
          }),
        );
      }
      const end = yield* Effect.promise(() => recording.capture({ child, closed }));
      return reportCompletion({
        deps: input.deps,
        commandLine: input.command.join(" "),
        filePath: input.filePath,
        recording,
        end,
        elapsed: formatElapsed(input.deps.monotonicNow() - startedAt),
      });
    }),
  );

const runEscaped = (command: Command, deps: ResolvedDeps): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* runRecorded() {
      const rootDir = deps.spoolRoot();
      const filePath = joinPath(
        rootDir,
        recordNameOf({
          stampedInstant: deps.now(),
          command,
          uniqueSuffix: deps.uniqueSuffix(),
        }),
      );
      const opened = yield* Effect.promise(() => openRecordFile(rootDir, filePath));
      if (opened instanceof Error) {
        deps.stderr.write(recordFailureSummary(command.join(" "), { filePath, reason: opened }));
        return 1;
      }
      return yield* Effect.promise(() =>
        recordRun({ command, deps, filePath, fileStream: opened }),
      );
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
      (deps.isPassthrough ?? defaultIsPassthrough)()
        ? runPassthrough(command, resolved)
        : runEscaped(command, resolved),
  });
};
