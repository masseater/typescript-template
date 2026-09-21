import { Effect, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { ConfigurationInvalid } from "./configuration-invalid.ts";
import {
  HttpsOrigin,
  adminPageSize,
  distinctOrigins,
  maximumAdminPageSize,
  readAi,
  readConfig,
  usageAllowanceRemains,
} from "./index.ts";

const local = {
  APP_ORIGIN: "http://localhost:3001",
  AUTH_SECRET: "test-environment-secret-not-for-any-deployment",
  EMAIL_FROM: "sender@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
  OPS_EMAIL: "ops@example.test",
};

const workerBindings = {
  AI: { run: Effect.runPromise },
  ASSETS: { fetch: fetch },
  DB: { batch: queueMicrotask, prepare: structuredClone },
  EMAIL: { send: queueMicrotask },
};

const budgetWithinReserve = {
  budgetJpy: 5000,
  fixedCostUsd: 40,
  jpyPerUsd: 100,
  reserveUsd: 9,
};

const brokenBindings = [
  ["an assets binding with no fetch", { ASSETS: {} }, 'Expected Fetcher\n  at ["ASSETS"]'],
  ["a string where the fetcher goes", { ASSETS: "fetch" }, 'Expected Fetcher\n  at ["ASSETS"]'],
  [
    "an absent assets binding",
    { ASSETS: JSON.parse("null") as unknown },
    'Expected Fetcher\n  at ["ASSETS"]',
  ],
  [
    "a database with no batch",
    { DB: { prepare: queueMicrotask } },
    'Expected D1Database\n  at ["DB"]',
  ],
  [
    "a database with no prepare",
    { DB: { batch: queueMicrotask } },
    'Expected D1Database\n  at ["DB"]',
  ],
  [
    "a database whose batch is not callable",
    { DB: { batch: "batch", prepare: queueMicrotask } },
    'Expected D1Database\n  at ["DB"]',
  ],
  ["an email binding with no send", { EMAIL: {} }, 'Expected SendEmail\n  at ["EMAIL"]'],
] as const;

describe("readConfig", () => {
  const it = test.extend("workerConfig", () =>
    Effect.runPromise(readConfig({ ...local, ...workerBindings })));

  it("accepts the bindings the worker declares", ({ workerConfig }) => {
    expect(workerConfig).toStrictEqual({
      ...local,
      ...workerBindings,
      APP_RELEASE: "local",
      MAILPIT_SEND_URL: "http://127.0.0.1:8025/api/v1/send",
      local: true,
    });
  });
});

describe("readAi", () => {
  const it = test.extend("runner", () =>
    Effect.runPromise(readAi({ ...local, ...workerBindings })));

  it("returns the AI binding", ({ runner }) => {
    expect(runner).toStrictEqual(workerBindings.AI);
  });
});

describe("a worker without an AI binding", () => {
  const it = test.extend("runner", () => Effect.runPromise(readAi(local)));

  it("leaves the runner absent", ({ runner }) => {
    expect(runner).toStrictEqual(undefined);
  });
});

describe("an AI binding with no run", () => {
  const it = test.extend("refusal", () =>
    Effect.runPromise(readAi({ ...local, AI: {} }).pipe(Effect.flip)));

  it("names the AI binding", ({ refusal }) => {
    expect(refusal).toStrictEqual(new ConfigurationInvalid({ reason: 'Expected Ai\n  at ["AI"]' }));
  });
});

describe.for(brokenBindings)("%s", ([, broken, reasonText]) => {
  const it = test.extend("refusal", () =>
    Effect.runPromise(readConfig({ ...local, ...workerBindings, ...broken }).pipe(Effect.flip)));

  it("names the binding it rejects", ({ refusal }) => {
    expect(refusal).toStrictEqual(new ConfigurationInvalid({ reason: reasonText }));
  });
});

describe("HttpsOrigin", () => {
  const it = test.extend("decodedOrigin", () =>
    Effect.runPromise(Schema.decodeUnknownEffect(HttpsOrigin)("https://app.example.test")));

  it("accepts an https origin", ({ decodedOrigin }) => {
    expect(decodedOrigin).toBe("https://app.example.test");
  });
});

describe("an origin that is not https", () => {
  const it = test.extend("schemaMessage", () =>
    Effect.runPromise(
      Schema.decodeUnknownEffect(HttpsOrigin)("http://localhost").pipe(
        Effect.flip,
        Effect.map((schemaError) => schemaError.message),
      ),
    ));

  it("requires https", ({ schemaMessage }) => {
    expect(schemaMessage).toBe("HTTPS is required");
  });
});

describe.for([
  [["https://a.example.test", "https://b.example.test"], true],
  [["https://a.example.test", "https://a.example.test"], false],
] as const)("%j", ([origins, originsAreDistinct]) => {
  const it = test.extend("originsAreDistinct", () => distinctOrigins(origins));

  it("treats repeated origins as one", ({ originsAreDistinct: distinctness }) => {
    expect(distinctness).toBe(originsAreDistinct);
  });
});

describe("a budget that still covers fixed cost and reserve", () => {
  const it = test.extend("allowanceRemains", () => usageAllowanceRemains(budgetWithinReserve));

  it("keeps a usage allowance", ({ allowanceRemains }) => {
    expect(allowanceRemains).toBe(true);
  });
});

describe("a reserve that consumes the budget", () => {
  const it = test.extend("allowanceRemains", () =>
    usageAllowanceRemains({ ...budgetWithinReserve, reserveUsd: 10 }));

  it("keeps no usage allowance", ({ allowanceRemains }) => {
    expect(allowanceRemains).toBe(false);
  });
});

describe("adminPageSize", () => {
  const it = test.extend("pageSize", () => adminPageSize);

  it("pages administrators fifty at a time", ({ pageSize }) => {
    expect(pageSize).toBe(50);
  });
});

describe("maximumAdminPageSize", () => {
  const it = test.extend("pageLimit", () => maximumAdminPageSize);

  it("never pages more than one hundred", ({ pageLimit }) => {
    expect(pageLimit).toBe(100);
  });
});

describe("mail delivery", () => {
  const { MAILPIT_URL: _mailpit, ...withoutMailpit } = local;
  const { EMAIL: _email, ...withoutEmail } = workerBindings;
  const it = test.extend("refusal", () =>
    Effect.runPromise(
      readConfig({
        ...withoutMailpit,
        ...withoutEmail,
        APP_ORIGIN: "https://app.example.test",
      }).pipe(Effect.flip),
    ));

  it("requires a way to deliver mail", ({ refusal }) => {
    expect(refusal).toStrictEqual(
      new ConfigurationInvalid({ reason: "An email delivery binding is required" }),
    );
  });
});
