import { createHmac } from "node:crypto";
import { ensure } from "./support.ts";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const base32BitsPerCharacter = 5;
const bitsPerByte = 8;
const binaryRadix = 2;
const counterBytes = 8;
const millisecondsPerSecond = 1000;
const defaultDigits = 6;
const extendedDigits = 8;
const defaultPeriodSeconds = 30;
const supportedDigits = new Set([defaultDigits, extendedDigits]);
const supportedAlgorithms = new Set(["SHA1", "SHA256", "SHA512"]);
const dynamicOffsetModulus = 16;
const truncatedBinaryModulus = 2_147_483_648;
const decimalBase = 10;

interface TotpParameters {
  readonly algorithm: string;
  readonly digits: number;
  readonly encodedSecret: string;
  readonly periodSeconds: number;
}

function parseTotpUri(uri: string): TotpParameters {
  const parsed = new URL(uri);
  ensure(parsed.protocol === "otpauth:" && parsed.hostname === "totp", "E2E_INVALID_TOTP_URI");
  const encodedSecret = parsed.searchParams.get("secret")?.toUpperCase().replace(/=+$/u, "");
  ensure(
    encodedSecret !== undefined && /^[A-Z2-7]+$/u.test(encodedSecret),
    "E2E_INVALID_TOTP_SECRET",
  );
  const parameters = {
    algorithm: parsed.searchParams.get("algorithm") ?? "SHA1",
    digits: Number(parsed.searchParams.get("digits") ?? defaultDigits),
    encodedSecret,
    periodSeconds: Number(parsed.searchParams.get("period") ?? defaultPeriodSeconds),
  };
  ensure(
    supportedDigits.has(parameters.digits) &&
      Number.isInteger(parameters.periodSeconds) &&
      parameters.periodSeconds > 0 &&
      supportedAlgorithms.has(parameters.algorithm),
    "E2E_INVALID_TOTP_PARAMETERS",
  );
  return parameters;
}

function decodeBase32(encoded: string): Buffer {
  const bits = Array.from(encoded, (character) =>
    base32Alphabet.indexOf(character).toString(binaryRadix).padStart(base32BitsPerCharacter, "0"),
  ).join("");
  return Buffer.from(
    Array.from({ length: Math.floor(bits.length / bitsPerByte) }, (_byte, index) =>
      Number.parseInt(bits.slice(index * bitsPerByte, (index + 1) * bitsPerByte), binaryRadix),
    ),
  );
}

function hotp(parameters: TotpParameters, counter: bigint): string {
  const counterBuffer = Buffer.alloc(counterBytes);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac(
    parameters.algorithm.toLowerCase(),
    decodeBase32(parameters.encodedSecret),
  )
    .update(counterBuffer)
    .digest();
  const offset = (digest.at(-1) ?? 0) % dynamicOffsetModulus;
  const truncated = digest.readUInt32BE(offset) % truncatedBinaryModulus;
  return String(truncated % decimalBase ** parameters.digits).padStart(parameters.digits, "0");
}

export function totp(uri: string, now = Date.now()): string {
  const parameters = parseTotpUri(uri);
  return hotp(
    parameters,
    BigInt(Math.floor(now / millisecondsPerSecond / parameters.periodSeconds)),
  );
}
