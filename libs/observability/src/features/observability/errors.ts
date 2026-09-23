import { Schema } from "effect";

import { hexRadix } from "./protocol.ts";
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
type ErrorAttributes = {
  readonly "error.fingerprint": string;
  readonly "error.locations": string;
  readonly "error.type"?: string;
};
const maximumLocations = 20;
const maximumLocationsLength = 2048;
const maximumLocationLength = 256;
const fingerprintFrames = 5;
const fingerprintWidth = 8;
const fnvOffsetBasis = 2166136261;
const fnvPrime = 16777619;
const locationSource = String.raw`(?:\/assets\/)?[\w.-]+\.[cm]?[jt]sx?:\d+:\d+`;
const identifierPattern = /^[A-Za-z]{1,64}$/u;
const errorType = (decoded: unknown): ErrorType | undefined => {
  return errorTypes.find((candidate) => candidate === decoded);
};
const errorLocations = (stack: string | undefined): string => {
  const locationPattern = new RegExp(locationSource, "gu");
  return Array.from(
    stack?.matchAll(locationPattern) ?? [],
    ([location = ""]: readonly string[]) => location,
  )
    .slice(0, maximumLocations)
    .join("\n");
};
const locationsBounded = (decoded: string): boolean => {
  const locationLine = new RegExp(`^${locationSource}$`, "u");
  return (
    decoded === "" ||
    decoded
      .split("\n")
      .every((line) => line.length <= maximumLocationLength && locationLine.test(line))
  );
};
const ErrorLocations = Schema.String.check(
  Schema.isMaxLength(maximumLocationsLength),
  Schema.makeFilter(locationsBounded),
);
const errorFingerprint = (typedTag: string, locations: string): string => {
  const frames = locations.split("\n").slice(0, fingerprintFrames).join("\n");
  const hash = Array.from(`${typedTag}\n${frames}`).reduce(
    (running, character) => Math.imul(running ^ (character.codePointAt(0) ?? 0), fnvPrime) >>> 0,
    fnvOffsetBasis,
  );
  return hash.toString(hexRadix).padStart(fingerprintWidth, "0");
};
const fingerprintIdentity = (caughtError: unknown): string => {
  if (caughtError instanceof Error) {
    return caughtError.name;
  }
  return Object.prototype.toString.call(caughtError);
};
const reportedErrorType = (caughtError: unknown): string | undefined => {
  if (!(caughtError instanceof Error)) {
    return undefined;
  }
  const known = errorType(caughtError.name);
  if (known !== undefined) {
    return known;
  }
  return identifierPattern.test(caughtError.name) ? caughtError.name : undefined;
};
const errorAttributes = (caughtError: unknown): ErrorAttributes => {
  const locations = caughtError instanceof Error ? errorLocations(caughtError.stack) : "";
  const typedTag = reportedErrorType(caughtError);
  const attributes: ErrorAttributes = {
    "error.fingerprint": errorFingerprint(fingerprintIdentity(caughtError), locations),
    "error.locations": locations,
  };
  return typedTag === undefined ? attributes : { ...attributes, "error.type": typedTag };
};
const wireErrorType = (typedTag: string | undefined): ErrorType => {
  return errorType(typedTag) ?? "Error";
};
export {
  ErrorLocations,
  errorAttributes,
  errorFingerprint,
  errorTypes,
  fingerprintIdentity,
  identifierPattern,
  wireErrorType,
};
