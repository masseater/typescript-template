type LogFields = Readonly<Record<string, string | number | boolean>>;

interface LogSink {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
}

function logError(fields: LogFields): void {
  // oxlint-disable-next-line no-console
  console.error(JSON.stringify(fields));
}

export { logError };
export type { LogSink };
