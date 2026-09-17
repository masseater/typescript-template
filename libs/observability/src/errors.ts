export function errorAttributes(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const type = [
    "Error",
    "TypeError",
    "RangeError",
    "SyntaxError",
    "ReferenceError",
    "URIError",
    "EvalError",
    "AggregateError",
    "APIError",
  ].includes(name)
    ? name
    : "Error";
  const locations =
    error instanceof Error
      ? Array.from(error.stack?.matchAll(/(?:\/assets\/)?[\w.-]+\.[cm]?[jt]sx?:\d+:\d+/g) ?? [])
          .slice(0, 20)
          .map((match) => match[0])
          .join("\n")
      : "";
  return { "error.type": type, "error.locations": locations };
}
