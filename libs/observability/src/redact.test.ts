import { describe, expect, it } from "vite-plus/test";

import { redactSecrets, redactedField } from "./redact.ts";

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
        redactedField(key, { nested: secret }),
      ),
    ).toStrictEqual([
      "[redacted]",
      "[redacted]",
      "[redacted]",
      { nested: secret },
      { nested: secret },
    ]);
  });
});

describe("the field rule every log line is written through", () => {
  it("keeps the name and the message of an error a field holds, minus the secret", () => {
    expect.hasAssertions();
    expect(
      JSON.stringify({ cause: new Error(`AUTH_SECRET="${secret}" is rejected`) }, redactedField),
    ).toBe(
      String.raw`{"cause":{"message":"AUTH_SECRET=\"[redacted]\" is rejected","name":"Error"}}`,
    );
  });
});

describe("cookies a header joins with a comma", () => {
  it("hides every cookie a header carries, not only the one before the first comma", () => {
    expect.hasAssertions();
    expect([
      redactSecrets(`set-cookie: theme=dark; Path=/, template-user.session=${secret}; HttpOnly`),
      redactSecrets(`Cookie: theme=dark, template-user.session=${secret}`),
      redactSecrets(`set-cookie: theme=dark, template-user.session=${secret}\nstatus: 500`),
    ]).toStrictEqual([
      "set-cookie: [redacted]",
      "Cookie: [redacted]",
      "set-cookie: [redacted]\nstatus: 500",
    ]);
  });

  it("stops at the comma when the name only looks like a list, so JSON stays parseable", () => {
    expect.hasAssertions();
    const redacted = redactSecrets('{"paramsCount":2,"hasCookie":true,"reason":"boom"}');
    expect([redacted, JSON.parse(redacted)]).toStrictEqual([
      '{"paramsCount":"[redacted]","hasCookie":"[redacted]","reason":"boom"}',
      { hasCookie: "[redacted]", paramsCount: "[redacted]", reason: "boom" },
    ]);
  });
});

describe("query parameters a failed statement reports", () => {
  it("hides every query parameter, keeping the statement readable", () => {
    expect.hasAssertions();
    expect([
      redactSecrets(`Failed query: select 1 from user where name = ?\nparams: alpha,${secret}`),
      redactSecrets(`Failed query: select 1\nparams: ${secret}\n    at run (file.ts:1:1)`),
    ]).toStrictEqual([
      "Failed query: select 1 from user where name = ?\nparams: [redacted]",
      "Failed query: select 1\nparams: [redacted]\n    at run (file.ts:1:1)",
    ]);
  });
});

describe("lists a log line carries JSON encoded", () => {
  it("keeps JSON parseable when the list sits inside an encoded message", () => {
    expect.hasAssertions();
    const header = redactSecrets(
      JSON.stringify({ headers: `set-cookie: a=1, session=${secret}`, reason: "boom" }),
    );
    const query = redactSecrets(
      JSON.stringify({
        message: `Failed query: select 1\nparams: ${secret}\n    at run`,
        name: "Error",
      }),
    );
    expect([header, JSON.parse(header), JSON.parse(query)]).toStrictEqual([
      '{"headers":"set-cookie: [redacted]","reason":"boom"}',
      { headers: "set-cookie: [redacted]", reason: "boom" },
      { message: "Failed query: select 1\nparams: [redacted]\n    at run", name: "Error" },
    ]);
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

describe("stack locations a failure reports", () => {
  it("keeps the line and column of a file whose name only looks like a secret", () => {
    expect.hasAssertions();
    expect([
      redactedField("error.locations", "cookie-banner.tsx:5:1\nindex-abc.js:1:234"),
      redactedField("error.type", "cookie-banner.tsx:5:1"),
    ]).toStrictEqual(["cookie-banner.tsx:5:1\nindex-abc.js:1:234", "cookie-banner.tsx:[redacted]"]);
  });

  it("still hides a secret a location line carries", () => {
    expect.hasAssertions();
    expect(redactedField("error.locations", `bundle.js:1:2 token=${secret}`)).toBe(
      "bundle.js:1:2 token=[redacted]",
    );
  });
});
