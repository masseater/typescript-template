export const errorTypes = [
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "AggregateError",
  "APIError",
] as const;
export type ErrorType = (typeof errorTypes)[number];

const locationPattern = /(?:\/assets\/)?[\w.-]+\.[cm]?[jt]sx?:\d+:\d+/g;

function errorLocations(stack: string | undefined): string {
  return Array.from(stack?.matchAll(locationPattern) ?? [])
    .slice(0, 20)
    .map((match) => match[0])
    .join("\n");
}

export function validErrorLocations(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 2048 &&
    (value === "" ||
      value
        .split("\n")
        .every(
          (line) => new RegExp(`^${locationPattern.source}$`).test(line) && line.length <= 256,
        ))
  );
}

export function errorFingerprint(type: ErrorType, locations: string): string {
  let hash = 0x811c9dc5;
  for (const character of `${type}\n${locations.split("\n").slice(0, 5).join("\n")}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function errorAttributes(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const type = errorTypes.find((candidate) => candidate === name) ?? "Error";
  const locations = error instanceof Error ? errorLocations(error.stack) : "";
  return {
    "error.type": type,
    "error.locations": locations,
    "error.fingerprint": errorFingerprint(type, locations),
  };
}
