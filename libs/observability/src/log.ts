export type LogSink = {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
};

const writeConsole =
  (level: keyof LogSink) =>
  (line: string): void => {
    console[level](line);
  };

export const consoleSink: LogSink = { error: writeConsole("error"), info: writeConsole("info") };

export const logError = (fields: Readonly<Record<string, unknown>>): void => {
  consoleSink.error(JSON.stringify(fields));
};

export const logInfo = (fields: Readonly<Record<string, unknown>>): void => {
  consoleSink.info(JSON.stringify(fields));
};
