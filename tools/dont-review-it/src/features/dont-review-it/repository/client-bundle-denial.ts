const deniedPatterns: readonly RegExp[] = [
  /Denied by file pattern: (?<pattern>\S+)/u,
  /Denied by specifier pattern: (?<pattern>\S+)/u,
];

const denialReason = (error: unknown): string => {
  const text = String(error);
  const pattern = deniedPatterns
    .map((denied) => denied.exec(text)?.groups?.["pattern"])
    .find((matched) => matched !== undefined);
  return pattern ?? (text.includes("Denied by marker") ? "marker" : "denied");
};

export { denialReason };
