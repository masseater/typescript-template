import { describe, expect, it } from "vite-plus/test";
import { isSecretKey, redactSecrets } from "./redact.ts";

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
      redactSecrets(`cookie: theme=dark; template-user.session=${secret}`),
      redactSecrets(`authorization: Bearer ${secret}`),
      redactSecrets(JSON.stringify({ clientSecret: secret, password: secret })),
      redactSecrets(JSON.stringify({ AUTH_SECRET: `pre"${secret}` })),
      redactSecrets(`CLOUDFLARE_ACCOUNT_ID=${secret}`),
    ]).toStrictEqual([
      '{"AUTH_SECRET":"[redacted]"}',
      "AUTH_SECRET=[redacted]",
      "TEMPLATE_AUTH_SECRET: [redacted]",
      '{"CLOUDFLARE_API_TOKEN":"[redacted]"}',
      "set-cookie: [redacted]",
      "cookie: [redacted]",
      "authorization: [redacted]",
      '{"clientSecret":"[redacted]","password":"[redacted]"}',
      '{"AUTH_SECRET":"[redacted]"}',
      "CLOUDFLARE_ACCOUNT_ID=[redacted]",
    ]);
  });
});

describe("secret redaction boundaries", () => {
  it("keeps JSON parseable when a secret name holds a value that is not a string", () => {
    expect.hasAssertions();
    const redacted = redactSecrets('{"hasSecret":true,"reason":"boom","other":"keep"}');
    expect([redacted, JSON.parse(redacted)]).toStrictEqual([
      '{"hasSecret":"[redacted]","reason":"boom","other":"keep"}',
      { hasSecret: "[redacted]", other: "keep", reason: "boom" },
    ]);
  });

  it("masks only the line that holds an unterminated quoted secret", () => {
    expect.hasAssertions();
    expect(redactSecrets(`AUTH_SECRET="${secret}\nnext line "stays"`)).toBe(
      'AUTH_SECRET="[redacted]"\nnext line "stays"',
    );
  });

  it("leaves the rest of the line readable so the failing setting stays diagnosable", () => {
    expect.hasAssertions();
    expect([
      redactSecrets('{"tokenCount":12,"reason":"boom"}'),
      redactSecrets('Expected a value with a length of at least 32\n  at ["AUTH_SECRET"]'),
      redactSecrets("D1_ERROR: no such table: jwks"),
    ]).toStrictEqual([
      '{"tokenCount":"[redacted]","reason":"boom"}',
      'Expected a value with a length of at least 32\n  at ["AUTH_SECRET"]',
      "D1_ERROR: no such table: jwks",
    ]);
  });

  it("recognizes a secret by its key alone", () => {
    expect.hasAssertions();
    expect(
      ["AUTH_SECRET", "clientSecret", "TEMPLATE_PREFIX", "reason", "query"].map((key) =>
        isSecretKey(key),
      ),
    ).toStrictEqual([true, true, true, false, false]);
  });
});

describe("secrets held by a structured value", () => {
  it("hides the whole object or array a secret name holds, not just up to its first comma", () => {
    expect.hasAssertions();
    const nested = redactSecrets('{"secret":{"x":1,"value":"LEAK"},"reason":"boom"}');
    const list = redactSecrets('{"tokens":["a","LEAK"],"reason":"boom"}');
    const empty = redactSecrets('{"tokens":[],"reason":"boom"}');
    expect([nested, list, empty, JSON.parse(nested), JSON.parse(list)]).toStrictEqual([
      '{"secret":"[redacted]","reason":"boom"}',
      '{"tokens":"[redacted]","reason":"boom"}',
      '{"tokens":"[redacted]","reason":"boom"}',
      { reason: "boom", secret: "[redacted]" },
      { reason: "boom", tokens: "[redacted]" },
    ]);
  });
});
