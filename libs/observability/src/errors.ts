type ErrorAttributes = Readonly<Record<"error.locations" | "error.type", string>>;

const maximumLocations = 20;

function errorAttributes(error: unknown): ErrorAttributes {
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
      ? (error.stack?.match(/(?:\/assets\/)?[\w.-]+\.[cm]?[jt]sx?:\d+:\d+/gu) ?? [])
          .slice(0, maximumLocations)
          .join("\n")
      : "";
  return { "error.locations": locations, "error.type": type };
}

export { errorAttributes };
