import { Schema } from "effect";

import { hexRadix } from "./protocol.ts";

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

const [genericErrorType] = errorTypes;

type ErrorType = (typeof errorTypes)[number];

export type ErrorAttributes = {
  readonly "error.fingerprint": string;
  readonly "error.locations": string;
  readonly "error.type": ErrorType;
};

const maximumLocations = 20;
const maximumLocationsLength = 2048;
const maximumLocationLength = 256;
const fingerprintFrames = 5;
const fingerprintWidth = 8;
const fnvOffsetBasis = 2_166_136_261;
const fnvPrime = 16_777_619;
const locationSource = String.raw`(?:\/assets\/)?[\w.-]+\.[cm]?[jt]sx?:\d+:\d+`;

const locationPattern = new RegExp(locationSource, "gu");

const locationLine = new RegExp(`^${locationSource}$`, "u");

export const ErrorLocations = Schema.String.check(
  Schema.isMaxLength(maximumLocationsLength),
  Schema.makeFilter(
    (locations: string) =>
      locations === "" ||
      locations
        .split("\n")
        .every((line) => line.length <= maximumLocationLength && locationLine.test(line)),
  ),
);

export const errorFingerprint = (fingerprinted: {
  readonly errorType: ErrorType;
  readonly locations: string;
}): string => {
  const frames = fingerprinted.locations.split("\n").slice(0, fingerprintFrames).join("\n");
  const hash = Array.from(`${fingerprinted.errorType}\n${frames}`).reduce(
    (running, character) => Math.imul(running ^ (character.codePointAt(0) ?? 0), fnvPrime) >>> 0,
    fnvOffsetBasis,
  );
  return hash.toString(hexRadix).padStart(fingerprintWidth, "0");
};

export const errorAttributes = (thrown: unknown): ErrorAttributes => {
  const errorType =
    errorTypes.find((candidate) => thrown instanceof Error && candidate === thrown.name) ??
    genericErrorType;
  const locations =
    thrown instanceof Error
      ? Array.from(thrown.stack?.matchAll(locationPattern) ?? [], ([location = ""]) => location)
          .slice(0, maximumLocations)
          .join("\n")
      : "";
  return {
    "error.fingerprint": errorFingerprint({ errorType, locations }),
    "error.locations": locations,
    "error.type": errorType,
  };
};
