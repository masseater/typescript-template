import type { LogSink } from "./structured-logs.ts";

interface RecordedLogs {
  readonly sink: LogSink;
  readonly stderr: readonly unknown[];
  readonly stdout: readonly unknown[];
}

function recordingSink(): RecordedLogs {
  const stderr: unknown[] = [];
  const stdout: unknown[] = [];
  return {
    sink: {
      error: (line) => {
        stderr.push(JSON.parse(line));
      },
      info: (line) => {
        stdout.push(JSON.parse(line));
      },
    },
    stderr,
    stdout,
  };
}

export { recordingSink };
