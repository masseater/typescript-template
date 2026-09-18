import { describe, expect, it } from "vite-plus/test";
import { redactSecrets } from "./redact.ts";

const secret = "worker-test-secret-at-least-32-characters";

describe("secret redaction", () => {
  it("hides the value bound to a secret name in every serialization a log line carries", () => {
    expect.hasAssertions();
    expect([
      redactSecrets(JSON.stringify({ AUTH_SECRET: secret })),
      redactSecrets(`AUTH_SECRET=${secret}`),
      redactSecrets(`TEMPLATE_AUTH_SECRET: ${secret}`),
      redactSecrets(JSON.stringify({ CLOUDFLARE_API_TOKEN: secret })),
      redactSecrets(`set-cookie: template-user.session=${secret}; HttpOnly`),
      redactSecrets(`authorization: Bearer ${secret}`),
      redactSecrets(JSON.stringify({ clientSecret: secret, password: secret })),
    ]).toStrictEqual([
      '{"AUTH_SECRET":[redacted]}',
      "AUTH_SECRET=[redacted]",
      "TEMPLATE_AUTH_SECRET: [redacted]",
      '{"CLOUDFLARE_API_TOKEN":[redacted]}',
      "set-cookie: [redacted]",
      "authorization: [redacted]",
      '{"clientSecret":[redacted],"password":[redacted]}',
    ]);
  });

  it("keeps the names of secret bindings so the failing setting stays readable", () => {
    expect.hasAssertions();
    expect([
      redactSecrets('Expected a value with a length of at least 32\n  at ["AUTH_SECRET"]'),
      redactSecrets("D1_ERROR: no such table: jwks"),
    ]).toStrictEqual([
      'Expected a value with a length of at least 32\n  at ["AUTH_SECRET"]',
      "D1_ERROR: no such table: jwks",
    ]);
  });
});
