export const bashCommandOf = (toolInput: unknown): string =>
  typeof toolInput === "object" &&
  toolInput !== null &&
  "command" in toolInput &&
  typeof toolInput.command === "string"
    ? toolInput.command
    : "";
