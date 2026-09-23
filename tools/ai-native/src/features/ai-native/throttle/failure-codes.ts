const codedSpelling = (failure: unknown): string | undefined =>
  failure instanceof Error && "code" in failure && typeof failure.code === "string"
    ? failure.code
    : undefined;

export const failedWithCode = (failure: unknown, codes: ReadonlySet<string>): boolean => {
  const spelling = codedSpelling(failure);
  if (spelling !== undefined) return codes.has(spelling);
  const cause =
    typeof failure === "object" && failure !== null && "cause" in failure
      ? failure.cause
      : undefined;
  return cause !== undefined && failedWithCode(cause, codes);
};

export const failureSpelling = (failure: unknown): string => {
  const spelling = codedSpelling(failure);
  if (spelling !== undefined) return spelling;
  if (
    typeof failure === "object" &&
    failure !== null &&
    "name" in failure &&
    "message" in failure &&
    typeof failure.name === "string" &&
    typeof failure.message === "string"
  ) {
    return `${failure.name}: ${failure.message}`;
  }
  return String(failure);
};
