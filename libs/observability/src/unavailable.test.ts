import { Cause, Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { recordingSink } from "./testing.ts";
import { reportUnavailable } from "./unavailable.ts";

class LayerFailed extends Schema.TaggedError<LayerFailed>()("LayerFailed", {
  cause: Schema.Defect(),
}) {}

const summaryLength = 512;
const overlongFactor = 8;
const leaked = "worker-test-secret-at-least-32-characters";

async function reportedLine(cause: unknown): Promise<unknown> {
  const logs = recordingSink();
  const failure = Cause.fail(new LayerFailed({ cause }));
  await Effect.runPromise(
    reportUnavailable(failure, { log: logs.sink, service: "internal-dashboard" }),
  );
  expect(logs.stdout).toHaveLength(0);
  expect(logs.stderr).toHaveLength(1);
  return logs.stderr[0];
}

describe("reporting a runtime that could not be built", () => {
  it("keeps the tag of a failure nested inside the failure that broke the layer", async () => {
    expect.hasAssertions();
    await expect(reportedLine(new LayerFailed({ cause: "select 1" }))).resolves.toMatchObject({
      "error.fields": '{"_tag":"LayerFailed","cause":{"_tag":"LayerFailed","cause":"select 1"}}',
      "error.tag": "LayerFailed",
      event: "application.runtime_unavailable",
      service: "internal-dashboard-server",
    });
  });

  it("keeps the text of a plain error that a tagged failure wraps", async () => {
    expect.hasAssertions();
    await expect(reportedLine(new Error("D1_ERROR: no such table: jwks"))).resolves.toMatchObject({
      "error.fields":
        '{"_tag":"LayerFailed","cause":{"message":"D1_ERROR: no such table: jwks","name":"Error"}}',
    });
  });
});

describe("naming the cause that actually broke the layer", () => {
  it("puts the innermost cause first so a long outer message cannot bury it", async () => {
    expect.hasAssertions();
    const root = new Error("D1_ERROR: no such table: oauth_resource: SQLITE_ERROR");
    const query = new Error(`Failed query: ${"select column, ".repeat(summaryLength)}`, {
      cause: root,
    });
    await expect(reportedLine(query)).resolves.toMatchObject({
      "error.chain": expect.stringContaining(
        "Error: D1_ERROR: no such table: oauth_resource: SQLITE_ERROR < Error: Failed query:",
      ) as unknown,
    });
  });

  it("keeps the fields of a plain error that broke the layer outright", async () => {
    expect.hasAssertions();
    const logs = recordingSink();
    const defect = Cause.die(new Error("D1_ERROR: no such table: jwks"));
    await Effect.runPromise(
      reportUnavailable(defect, { log: logs.sink, service: "internal-dashboard" }),
    );
    expect(logs.stderr[0]).toMatchObject({
      "error.chain": "Error: D1_ERROR: no such table: jwks",
      "error.fields": '{"message":"D1_ERROR: no such table: jwks","name":"Error"}',
    });
  });
});

describe("bounding what a runtime failure report carries", () => {
  it("says so instead of reporting empty fields when the failure cannot be serialized", async () => {
    expect.hasAssertions();
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    await expect(Promise.all([reportedLine(circular), reportedLine(1n)])).resolves.toMatchObject([
      { "error.fields": "[unserializable]" },
      { "error.fields": "[unserializable]" },
    ]);
  });

  it("marks a summary that did not fit instead of ending it silently", async () => {
    expect.hasAssertions();
    const message = "x".repeat(summaryLength * overlongFactor);
    const encoded = JSON.stringify({ _tag: "LayerFailed", cause: { message, name: "Error" } });
    await expect(reportedLine(new Error(message))).resolves.toMatchObject({
      "error.fields": `${encoded.slice(0, summaryLength)}…`,
    });
  });

  it("hides a secret carried in a message or under a secret key", async () => {
    expect.hasAssertions();
    const inMessage = reportedLine(new Error('AUTH_SECRET="leaked-value" is rejected'));
    const underKey = reportedLine({ AUTH_SECRET: "leaked-value", reason: "too short" });
    await expect(Promise.all([inMessage, underKey])).resolves.toMatchObject([
      {
        "error.fields": String.raw`{"_tag":"LayerFailed","cause":{"message":"AUTH_SECRET=\"[redacted]\" is rejected","name":"Error"}}`,
      },
      {
        "error.fields":
          '{"_tag":"LayerFailed","cause":{"AUTH_SECRET":"[redacted]","reason":"too short"}}',
      },
    ]);
  });
});

describe("hiding a value that a comma used to cut short", () => {
  it("hides a cookie list and query parameters in the chain, the fields and the cause", async () => {
    expect.hasAssertions();
    const statement = new Error(
      `Failed query: select 1 from user where name = ?\nparams: alpha,${leaked}`,
      { cause: new Error(`set-cookie: theme=dark; Path=/, template-user.session=${leaked}`) },
    );
    const logs = recordingSink();
    await Effect.runPromise(
      reportUnavailable(Cause.die(statement), { log: logs.sink, service: "internal-dashboard" }),
    );
    expect(JSON.stringify(logs.stderr)).not.toContain(leaked);
    expect(logs.stderr[0]).toMatchObject({
      "error.cause": expect.stringContaining(
        "Error: Failed query: select 1 from user where name = ?\nparams: [redacted]",
      ) as unknown,
      "error.chain": [
        "Error: set-cookie: [redacted]",
        "Error: Failed query: select 1 from user where name = ?\nparams: [redacted]",
      ].join(" < "),
      "error.fields": String.raw`{"message":"Failed query: select 1 from user where name = ?\nparams: [redacted]","name":"Error"}`,
    });
  });

  it("hides the query parameters a failure carries under a params key", async () => {
    expect.hasAssertions();
    await expect(
      reportedLine({ params: [leaked], reason: "no such table" }),
    ).resolves.toMatchObject({
      "error.fields":
        '{"_tag":"LayerFailed","cause":{"params":"[redacted]","reason":"no such table"}}',
    });
  });
});
