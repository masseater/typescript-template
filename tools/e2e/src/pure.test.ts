import { assert, it } from "@effect/vitest";
import { Cause, Effect } from "effect";
import { totp } from "./totp.ts";
import { verificationLink } from "./mail.ts";
import { E2eFailure, decodeBrowserBatch, object, shellQuote, safeFailure } from "./support.ts";

const code = <A, R>(effect: Effect.Effect<A, E2eFailure, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure.code),
  );

it.effect("TOTP computes the RFC 6238 SHA-1 vectors using real HMAC", () =>
  Effect.gen(function* () {
    const uri = "otpauth://totp/test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8";
    assert.strictEqual(yield* totp(uri, 59_000), "94287082");
    assert.strictEqual(yield* totp(uri, 1_111_111_109_000), "07081804");
    assert.strictEqual(yield* totp(uri, 2_000_000_000_000), "69279037");
  }),
);

it.effect("TOTP rejects unsupported algorithms and non-base32 input", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      yield* code(totp("otpauth://totp/test?secret=INVALID0")),
      "E2E_INVALID_TOTP_SECRET",
    );
    assert.strictEqual(
      yield* code(totp("otpauth://totp/test?secret=AAAA&algorithm=MD5")),
      "E2E_INVALID_TOTP_PARAMETERS",
    );
  }),
);

it.effect(
  "verification links target this isolated worker and keep the token out of the request URL",
  () =>
    Effect.gen(function* () {
      const origin = "http://localhost:12345";
      const url = `${origin}/verify-email#token=public-test-vector`;
      assert.strictEqual(yield* verificationLink(`Verify:\n${url}`, origin), url);
      for (const link of [
        "https://outside.example/verify-email#token=x",
        `${origin}/verify-email`,
        `${origin}/verify-email?token=x`,
        `${origin}/api/auth/verify-email?token=x`,
      ])
        assert.strictEqual(
          yield* code(verificationLink(link, origin)),
          "E2E_VERIFICATION_LINK_MISSING",
        );
    }),
);

it.effect("browser command failures never propagate echoed inputs or browser error details", () =>
  Effect.gen(function* () {
    const failure = yield* Effect.flip(
      decodeBrowserBatch(
        JSON.stringify([
          {
            success: false,
            command: ["fill", "password", "secret-canary"],
            error: "secret-canary",
          },
        ]),
      ),
    );
    assert.strictEqual(failure.code, "E2E_BROWSER_COMMAND_FAILED");
    assert.notInclude(JSON.stringify(failure), "canary");
    assert.deepStrictEqual(
      yield* decodeBrowserBatch('[{"success":true,"result":{"value":1},"command":["private"]}]'),
      [{ value: 1 }],
    );
    assert.strictEqual(yield* code(object(null)), "E2E_INVALID_OBJECT_RESPONSE");
  }),
);

it("fish quoting treats special characters as literal path text", () => {
  assert.strictEqual(shellQuote("a'b\\c$() ;"), "'a\\'b\\\\c$() ;'");
});

it("failure reporting drops provider messages, secrets and nested causes", () => {
  const error = safeFailure(
    new Error("secret-canary", { cause: new Error("token-canary") }),
    "registration",
  );
  assert.match(
    error.message,
    /^E2E_OPERATION_FAILED; stage=registration; error=Error; at=pure\.test\.ts:\d+$/,
  );
  assert.notMatch(error.message, /canary/);
  const provider = new TypeError("secret-canary");
  provider.stack = "TypeError: secret-canary\n    at /tmp/secret-canary.ts:1:1";
  assert.strictEqual(
    safeFailure(provider, "totp").message,
    "E2E_OPERATION_FAILED; stage=totp; error=TypeError",
  );
  assert.isUndefined(error.cause);
  assert.strictEqual(
    safeFailure(new Error("E2E_VERIFIED_LOGIN_FAILED"), "registration").message,
    "E2E_VERIFIED_LOGIN_FAILED; stage=registration",
  );
  assert.strictEqual(
    safeFailure(new E2eFailure({ code: "E2E_VERIFIED_LOGIN_FAILED" }), "registration").message,
    "E2E_VERIFIED_LOGIN_FAILED; stage=registration",
  );
  assert.strictEqual(
    safeFailure(new Cause.UnknownError(provider, "secret-canary"), "totp").message,
    "E2E_OPERATION_FAILED; stage=totp; error=TypeError",
  );
});
