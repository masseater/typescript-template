import { expect, test } from "vite-plus/test";
import { totp } from "./totp.ts";
import { verificationLink } from "./mail.ts";
import { assertPrivate } from "./observation.ts";
import { decodeBrowserBatch, object, shellQuote, safeFailure } from "./support.ts";

test("TOTP computes the RFC 6238 SHA-1 vectors using real HMAC", () => {
  const uri = "otpauth://totp/test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8";
  expect(totp(uri, 59_000)).toBe("94287082");
  expect(totp(uri, 1_111_111_109_000)).toBe("07081804");
  expect(totp(uri, 2_000_000_000_000)).toBe("69279037");
});

test("TOTP rejects unsupported algorithms and non-base32 input", () => {
  expect(() => totp("otpauth://totp/test?secret=INVALID0")).toThrow("E2E_INVALID_TOTP_SECRET");
  expect(() => totp("otpauth://totp/test?secret=AAAA&algorithm=MD5")).toThrow(
    "E2E_INVALID_TOTP_PARAMETERS",
  );
});

test("verification links target this isolated worker and keep the token out of the request URL", () => {
  const origin = "http://localhost:12345";
  const url = `${origin}/verify-email#token=public-test-vector`;
  expect(verificationLink(`Verify:\n${url}`, origin)).toBe(url);
  for (const link of [
    "https://outside.example/verify-email#token=x",
    `${origin}/verify-email`,
    `${origin}/verify-email?token=x`,
    `${origin}/api/auth/verify-email?token=x`,
  ])
    expect(() => verificationLink(link, origin)).toThrow("E2E_VERIFICATION_LINK_MISSING");
});

test("browser command failures never propagate echoed inputs or browser error details", () => {
  expect(() =>
    decodeBrowserBatch(
      JSON.stringify([
        { success: false, command: ["fill", "password", "secret-canary"], error: "secret-canary" },
      ]),
    ),
  ).toThrow(/^E2E_BROWSER_COMMAND_FAILED$/);
  expect(
    decodeBrowserBatch('[{"success":true,"result":{"value":1},"command":["private"]}]'),
  ).toEqual([{ value: 1 }]);
  expect(() => object(null)).toThrow("E2E_INVALID_OBJECT_RESPONSE");
});

test("fish quoting treats special characters as literal path text", () => {
  expect(shellQuote("a'b\\c$() ;")).toBe("'a\\'b\\\\c$() ;'");
});

test("failure reporting drops provider messages, secrets and nested causes", () => {
  const error = safeFailure(
    new Error("secret-canary", { cause: new Error("token-canary") }),
    "registration",
  );
  expect(error.message).toMatch(
    /^E2E_OPERATION_FAILED; stage=registration; error=Error; at=pure\.test\.ts:\d+$/,
  );
  expect(error.message).not.toMatch(/canary/);
  const provider = new TypeError("secret-canary");
  provider.stack = "TypeError: secret-canary\n    at /tmp/secret-canary.ts:1:1";
  expect(safeFailure(provider, "totp").message).toBe(
    "E2E_OPERATION_FAILED; stage=totp; error=TypeError",
  );
  expect(error.cause).toBeUndefined();
  expect(safeFailure(new Error("E2E_VERIFIED_LOGIN_FAILED"), "registration").message).toBe(
    "E2E_VERIFIED_LOGIN_FAILED; stage=registration",
  );
});

test("telemetry privacy check ignores numeric codes embedded in longer numbers only", () => {
  const telemetry = { timeUnixNano: "1789640123456000000", attributes: { status: 200 } };
  expect(() => assertPrivate(telemetry, ["123456"])).not.toThrow();
  expect(() => assertPrivate({ ...telemetry, code: "123456" }, ["123456"])).toThrow(
    "E2E_TELEMETRY_PII_LEAK",
  );
  expect(() => assertPrivate({ note: "otp=123456;" }, ["123456"])).toThrow(
    "E2E_TELEMETRY_PII_LEAK",
  );
  expect(() => assertPrivate({ email: "a+b@example.test" }, ["a+b@example.test"])).toThrow(
    "E2E_TELEMETRY_PII_LEAK",
  );
});
