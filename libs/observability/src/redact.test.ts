import { describe, expect, test } from "vite-plus/test";

import { redactSecrets, redactedField } from "./redact.ts";
const secret = "worker-test-secret-at-least-32-characters";
describe.for([
  [
    "a secret name in JSON",
    JSON.stringify({ AUTH_SECRET: secret }),
    '{"AUTH_SECRET":"[redacted]"}',
  ],
  ["a secret name in an assignment", `AUTH_SECRET=${secret}`, "AUTH_SECRET=[redacted]"],
  [
    "a prefixed secret name after a colon",
    `TEMPLATE_AUTH_SECRET: ${secret}`,
    "TEMPLATE_AUTH_SECRET: [redacted]",
  ],
  [
    "a deployment token in JSON",
    JSON.stringify({ CLOUDFLARE_API_TOKEN: secret }),
    '{"CLOUDFLARE_API_TOKEN":"[redacted]"}',
  ],
  [
    "a cookie a response sets",
    `set-cookie: template-user.session=${secret}; HttpOnly`,
    "set-cookie: [redacted]",
  ],
  [
    "a cookie a request carries",
    `cookie: theme=dark; template-user.session=${secret}`,
    "cookie: [redacted]",
  ],
  ["a bearer credential", `authorization: Bearer ${secret}`, "authorization: [redacted]"],
  [
    "two secret names in one object",
    JSON.stringify({ clientSecret: secret, password: secret }),
    '{"clientSecret":"[redacted]","password":"[redacted]"}',
  ],
  [
    "a quote inside the secret value",
    JSON.stringify({ AUTH_SECRET: `pre"${secret}` }),
    '{"AUTH_SECRET":"[redacted]"}',
  ],
  ["an account identifier", `CLOUDFLARE_ACCOUNT_ID=${secret}`, "CLOUDFLARE_ACCOUNT_ID=[redacted]"],
  [
    "a secret name holding a value that is not a string",
    '{"hasSecret":true,"reason":"boom","other":"keep"}',
    '{"hasSecret":"[redacted]","reason":"boom","other":"keep"}',
  ],
  [
    "an unterminated quoted secret",
    `AUTH_SECRET="${secret}\nnext line "stays"`,
    'AUTH_SECRET="[redacted]"\nnext line "stays"',
  ],
  [
    "a secret name inside a longer name",
    '{"tokenCount":12,"reason":"boom"}',
    '{"tokenCount":"[redacted]","reason":"boom"}',
  ],
  [
    "a secret name quoted inside a message",
    'Expected a value with a length of at least 32\n  at ["AUTH_SECRET"]',
    'Expected a value with a length of at least 32\n  at ["AUTH_SECRET"]',
  ],
  [
    "a message carrying no secret",
    "D1_ERROR: no such table: jwks",
    "D1_ERROR: no such table: jwks",
  ],
  [
    "a cookie list a comma joins",
    `set-cookie: theme=dark; Path=/, template-user.session=${secret}; HttpOnly`,
    "set-cookie: [redacted]",
  ],
  [
    "a cookie list a request joins",
    `Cookie: theme=dark, template-user.session=${secret}`,
    "Cookie: [redacted]",
  ],
  [
    "a cookie list followed by another line",
    `set-cookie: theme=dark, template-user.session=${secret}\nstatus: 500`,
    "set-cookie: [redacted]\nstatus: 500",
  ],
  [
    "a name that only looks like a list",
    '{"paramsCount":2,"hasCookie":true,"reason":"boom"}',
    '{"paramsCount":"[redacted]","hasCookie":"[redacted]","reason":"boom"}',
  ],
  [
    "query parameters a failed statement reports",
    `Failed query: select 1 from user where name = ?\nparams: alpha,${secret}`,
    "Failed query: select 1 from user where name = ?\nparams: [redacted]",
  ],
  [
    "query parameters followed by a stack frame",
    `Failed query: select 1\nparams: ${secret}\n    at run (file.ts:1:1)`,
    "Failed query: select 1\nparams: [redacted]\n    at run (file.ts:1:1)",
  ],
  [
    "a cookie list inside an encoded message",
    JSON.stringify({ headers: `set-cookie: a=1, session=${secret}`, reason: "boom" }),
    '{"headers":"set-cookie: [redacted]","reason":"boom"}',
  ],
  [
    "query parameters inside an encoded message",
    JSON.stringify({
      message: `Failed query: select 1\nparams: ${secret}\n    at run`,
      name: "Error",
    }),
    JSON.stringify({
      message: "Failed query: select 1\nparams: [redacted]\n    at run",
      name: "Error",
    }),
  ],
  [
    "an object a secret name holds",
    '{"secret":{"x":1,"value":"LEAK"},"reason":"boom"}',
    '{"secret":"[redacted]","reason":"boom"}',
  ],
  [
    "a list a secret name holds",
    '{"tokens":["a","LEAK"],"reason":"boom"}',
    '{"tokens":"[redacted]","reason":"boom"}',
  ],
  [
    "an empty list a secret name holds",
    '{"tokens":[],"reason":"boom"}',
    '{"tokens":"[redacted]","reason":"boom"}',
  ],
] as const)("%s", ([, written, expectedLine]) => {
  const it = test.extend("redactedLine", () => redactSecrets(written));
  it("leaves the line readable with the secret hidden", ({ redactedLine }) => {
    expect(redactedLine).toBe(expectedLine);
  });
});
describe.for([
  ["an environment secret", "AUTH_SECRET", "[redacted]"],
  ["a camel-cased secret", "clientSecret", "[redacted]"],
  ["a prefixed secret", "TEMPLATE_PREFIX", "[redacted]"],
  ["a reason", "reason", { nested: secret }],
  ["a query", "query", { nested: secret }],
] as const)("a field named after %s", ([, fieldName, expectedValue]) => {
  const it = test.extend("redactedValue", () => redactedField(fieldName, { nested: secret }));
  it("is settled by the name alone", ({ redactedValue }) => {
    expect(redactedValue).toStrictEqual(expectedValue);
  });
});
describe("an error a field holds", () => {
  const it = test.extend("encodedError", () =>
    JSON.stringify({ cause: new Error(`AUTH_SECRET="${secret}" is rejected`) }, redactedField));
  it("keeps the name and the message, minus the secret", ({ encodedError }) => {
    expect(encodedError).toBe(
      String.raw`{"cause":{"message":"AUTH_SECRET=\"[redacted]\" is rejected","name":"Error"}}`,
    );
  });
});
