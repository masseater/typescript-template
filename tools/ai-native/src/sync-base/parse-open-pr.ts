export type OpenPullRequest = {
  readonly baseRefName: string;
  readonly mergeStateStatus: string;
  readonly number: number;
  readonly url: string;
};

const stringField = (record: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const numberField = (
  record: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

export const parseOpenPullRequest = (printed: string): OpenPullRequest | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(printed) as unknown;
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const record = parsed as Readonly<Record<string, unknown>>;
  const baseRefName = stringField(record, "baseRefName");
  const mergeStateStatus = stringField(record, "mergeStateStatus");
  const url = stringField(record, "url");
  const number = numberField(record, "number");
  return baseRefName === undefined ||
    mergeStateStatus === undefined ||
    url === undefined ||
    number === undefined
    ? undefined
    : { baseRefName, mergeStateStatus, number, url };
};
