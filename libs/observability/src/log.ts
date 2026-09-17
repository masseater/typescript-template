type LogFields = Readonly<Record<string, string | number | boolean>>;

function logInfo(fields: LogFields): void {
  console.info(JSON.stringify(fields));
}

function logError(fields: LogFields): void {
  console.error(JSON.stringify(fields));
}

export { logError, logInfo };
