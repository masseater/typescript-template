import { createHmac } from "node:crypto";
import { ensure } from "./support.ts";

export function totp(uri: string, now = Date.now()): string {
  const parsed = new URL(uri);
  ensure(parsed.protocol === "otpauth:" && parsed.hostname === "totp", "E2E_INVALID_TOTP_URI");
  const encoded = parsed.searchParams.get("secret")?.toUpperCase().replace(/=+$/, "");
  ensure(encoded && /^[A-Z2-7]+$/.test(encoded), "E2E_INVALID_TOTP_SECRET");
  const digits = Number(parsed.searchParams.get("digits") ?? 6);
  const period = Number(parsed.searchParams.get("period") ?? 30);
  const algorithm = parsed.searchParams.get("algorithm") ?? "SHA1";
  ensure(
    [6, 8].includes(digits) &&
      Number.isInteger(period) &&
      period > 0 &&
      ["SHA1", "SHA256", "SHA512"].includes(algorithm),
    "E2E_INVALID_TOTP_PARAMETERS",
  );
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = encoded
    .split("")
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, "0"))
    .join("");
  const secret = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, index) =>
      Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / period)));
  const digest = createHmac(algorithm.toLowerCase(), secret).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}
