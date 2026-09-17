type LogFields = Readonly<Record<string, string | number | boolean>>;

function logInfo(fields: LogFields): void {
  // oxlint-disable-next-line no-console
  console.info(JSON.stringify(fields));
}

function logError(fields: LogFields): void {
  // oxlint-disable-next-line no-console
  console.error(JSON.stringify(fields));
}

export { logError, logInfo };
