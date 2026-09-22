import { Cause, Effect, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { recordingSink } from "./testing.ts";
import { reportUnavailable } from "./unavailable.ts";

class LayerFailed extends Schema.TaggedError<LayerFailed>()("LayerFailed", {
  cause: Schema.Defect(),
}) {}

describe("reportUnavailable nested tag", () => {
  const it = test.extend("fields", async () => {
    const logs = recordingSink();
    await Effect.runPromise(
      reportUnavailable(
        Cause.fail(new LayerFailed({ cause: new LayerFailed({ cause: "select 1" }) })),
        {
          log: logs.sink,
          service: "internal-dashboard",
        },
      ),
    );
    const line = logs.stderr[0] ?? {};
    return typeof line["error.fields"] === "string" ? line["error.fields"] : "";
  });

  it("keeps the nested failure fields", ({ fields }) => {
    expect(fields).toBe('{"_tag":"LayerFailed","cause":{"_tag":"LayerFailed","cause":"select 1"}}');
  });
});

describe("reportUnavailable wrapped plain error", () => {
  const it = test.extend("fields", async () => {
    const logs = recordingSink();
    await Effect.runPromise(
      reportUnavailable(
        Cause.fail(new LayerFailed({ cause: new Error("D1_ERROR: no such table: jwks") })),
        {
          log: logs.sink,
          service: "internal-dashboard",
        },
      ),
    );
    const line = logs.stderr[0] ?? {};
    return typeof line["error.fields"] === "string" ? line["error.fields"] : "";
  });

  it("keeps the wrapped plain error fields", ({ fields }) => {
    expect(fields).toBe(
      '{"_tag":"LayerFailed","cause":{"message":"D1_ERROR: no such table: jwks","name":"Error"}}',
    );
  });
});

describe("reportUnavailable secret in message", () => {
  const it = test.extend("fields", async () => {
    const logs = recordingSink();
    await Effect.runPromise(
      reportUnavailable(
        Cause.fail(new LayerFailed({ cause: new Error('AUTH_SECRET="leaked-value" is rejected') })),
        { log: logs.sink, service: "internal-dashboard" },
      ),
    );
    const line = logs.stderr[0] ?? {};
    return typeof line["error.fields"] === "string" ? line["error.fields"] : "";
  });

  it("hides a secret carried in a message", ({ fields }) => {
    expect(fields).toBe(
      String.raw`{"_tag":"LayerFailed","cause":{"message":"AUTH_SECRET=\"[redacted]\" is rejected","name":"Error"}}`,
    );
  });
});

describe("reportUnavailable secret under key", () => {
  const it = test.extend("fields", async () => {
    const logs = recordingSink();
    await Effect.runPromise(
      reportUnavailable(
        Cause.fail(
          new LayerFailed({ cause: { AUTH_SECRET: "leaked-value", reason: "too short" } }),
        ),
        { log: logs.sink, service: "internal-dashboard" },
      ),
    );
    const line = logs.stderr[0] ?? {};
    return typeof line["error.fields"] === "string" ? line["error.fields"] : "";
  });

  it("hides a secret under a secret key", ({ fields }) => {
    expect(fields).toBe(
      '{"_tag":"LayerFailed","cause":{"AUTH_SECRET":"[redacted]","reason":"too short"}}',
    );
  });
});
