type LogLevel = "error" | "info";

interface LogSink {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
}

const consoleError = (line: string): void => {
  // oxlint-disable-next-line no-console
  console.error(line);
};

const consoleInfo = (line: string): void => {
  // oxlint-disable-next-line no-console
  console.info(line);
};

const consoleSink: LogSink = { error: consoleError, info: consoleInfo };

type LogFields = Readonly<Record<string, string | number | boolean>>;

const writeLog = (sink: LogSink, level: LogLevel, fields: LogFields): void => {
  sink[level](JSON.stringify(fields));
};

const logError = (fields: LogFields): void => {
  writeLog(consoleSink, "error", fields);
};

export { consoleSink, logError };
export type { LogSink };
