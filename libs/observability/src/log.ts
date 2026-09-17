type LogFields = Readonly<Record<string, string | number | boolean>>;
type LogLevel = "error" | "info";

interface LogSink {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
}

function consoleError(line: string): void {
  // oxlint-disable-next-line no-console
  console.error(line);
}

function consoleInfo(line: string): void {
  // oxlint-disable-next-line no-console
  console.info(line);
}

const consoleSink: LogSink = { error: consoleError, info: consoleInfo };

function writeLog(sink: LogSink, level: LogLevel, fields: LogFields): void {
  sink[level](JSON.stringify(fields));
}

function logError(fields: LogFields): void {
  writeLog(consoleSink, "error", fields);
}

export { consoleSink, logError };
export type { LogSink };
