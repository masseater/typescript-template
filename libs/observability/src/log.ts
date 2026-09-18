/** @canonical-values observability.log-level */
const LOG_LEVELS = ["error", "info"] as const;

const [failureLevel, progressLevel] = LOG_LEVELS;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogSink = Readonly<Record<LogLevel, (line: string) => void>>;

export const consoleSink: LogSink = {
  error: (line) => {
    console[failureLevel](line);
  },
  info: (line) => {
    console[progressLevel](line);
  },
};

const writeLog = (level: LogLevel, fields: Readonly<Record<string, unknown>>): void => {
  consoleSink[level](JSON.stringify(fields));
};

export const logError = (fields: Readonly<Record<string, unknown>>): void => {
  writeLog(failureLevel, fields);
};

export const logInfo = (fields: Readonly<Record<string, unknown>>): void => {
  writeLog(progressLevel, fields);
};
