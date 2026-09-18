import type { LogSink } from "./structured-logs.ts";

interface RecordedLogs {
  readonly sink: LogSink;
  readonly stderr: readonly unknown[];
  readonly stdout: readonly unknown[];
  readonly stdwarn: readonly unknown[];
}

function recordingSink(): RecordedLogs {
  const stderr: unknown[] = [];
  const stdout: unknown[] = [];
  const stdwarn: unknown[] = [];
  return {
    sink: {
      error: (line) => {
        stderr.push(JSON.parse(line));
      },
      info: (line) => {
        stdout.push(JSON.parse(line));
      },
      warn: (line) => {
        stdwarn.push(JSON.parse(line));
      },
    },
    stderr,
    stdout,
    stdwarn,
  };
}

export { recordingSink };
