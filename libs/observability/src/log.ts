type LogLevel = "error" | "info";

type LogSink = {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
};

const consoleError = (line: string): void => {
  console.error(line);
};

const consoleInfo = (line: string): void => {
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
