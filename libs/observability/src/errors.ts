import { Schema } from "effect";

const errorTypes = [
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

type ErrorType = (typeof errorTypes)[number];
interface ErrorAttributes {
  readonly "error.fingerprint": string;
  readonly "error.locations": string;
  readonly "error.type"?: string;
}

const maximumLocations = 20;
const maximumLocationsLength = 2048;
const maximumLocationLength = 256;
const fingerprintFrames = 5;
const fingerprintWidth = 8;
const hexRadix = 16;
const fnvOffsetBasis = 2_166_136_261;
const fnvPrime = 16_777_619;
const locationSource = String.raw`(?:\/assets\/)?[\w.-]+\.[cm]?[jt]sx?:\d+:\d+`;
const locationPattern = new RegExp(locationSource, "gu");
const locationLine = new RegExp(`^${locationSource}$`, "u");
const identifierPattern = /^[A-Za-z]{1,64}$/u;

function errorType(value: unknown): ErrorType | undefined {
  return errorTypes.find((candidate) => candidate === value);
}

function errorLocations(stack: string | undefined): string {
  return Array.from(
    stack?.matchAll(locationPattern) ?? [],
    ([location = ""]: readonly string[]) => location,
  )
    .slice(0, maximumLocations)
    .join("\n");
}

function locationsBounded(value: string): boolean {
  return (
    value === "" ||
    value
      .split("\n")
      .every((line) => line.length <= maximumLocationLength && locationLine.test(line))
  );
}

const ErrorLocations = Schema.String.check(
  Schema.isMaxLength(maximumLocationsLength),
  Schema.makeFilter(locationsBounded),
);

function errorFingerprint(type: string, locations: string): string {
  const frames = locations.split("\n").slice(0, fingerprintFrames).join("\n");
  let hash = fnvOffsetBasis;
  for (const character of `${type}\n${frames}`) {
    // oxlint-disable-next-line no-bitwise
    hash ^= character.codePointAt(0) ?? 0;
    // oxlint-disable-next-line no-bitwise
    hash = Math.imul(hash, fnvPrime) >>> 0;
  }
  return hash.toString(hexRadix).padStart(fingerprintWidth, "0");
}

function fingerprintIdentity(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  return Object.prototype.toString.call(error);
}

function reportedErrorType(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const known = errorType(error.name);
  if (known !== undefined) {
    return known;
  }
  return identifierPattern.test(error.name) ? error.name : undefined;
}

function wireErrorType(type: string | undefined): ErrorType {
  return errorType(type) ?? "Error";
}

function errorAttributes(error: unknown): ErrorAttributes {
  const locations = error instanceof Error ? errorLocations(error.stack) : "";
  const type = reportedErrorType(error);
  const attributes: ErrorAttributes = {
    "error.fingerprint": errorFingerprint(fingerprintIdentity(error), locations),
    "error.locations": locations,
  };
  return type === undefined ? attributes : { ...attributes, "error.type": type };
}

export {
  ErrorLocations,
  errorAttributes,
  errorFingerprint,
  errorTypes,
  fingerprintIdentity,
  identifierPattern,
  wireErrorType,
};
export type { ErrorAttributes };
