import { Cause, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { recordedLogs } from "./testing.ts";
import { reportUnavailable } from "./unavailable.ts";

const pinnedFrame = "    at handle (/assets/app-abc.js:7:11)";
const pinnedStack = `LayerFailed: pinned\n${pinnedFrame}`;

class LayerFailed extends Schema.TaggedError<LayerFailed>()("LayerFailed", {
  cause: Schema.Defect(),
}) {
  public override readonly stack = pinnedStack;
}

const summaryLength = 512;
const overlongFactor = 8;
const truncationMark = "…";
const leaked = "worker-test-secret-at-least-32-characters";
const failedAttributes = {
  "error.fingerprint": "fe26c6a6",
  "error.locations": "/assets/app-abc.js:7:11",
  "error.type": "Error",
  "error.tag": "LayerFailed",
};
const reportedEvent = { event: "application.runtime_unavailable", service: "wiki-server" };

const missingTable = "D1_ERROR: no such table: jwks";
const overlongQuery = `Failed query: ${"select column, ".repeat(summaryLength)}`;
const buriedRootMessage = "D1_ERROR: no such table: oauth_resource: SQLITE_ERROR";
const overlongMessage = "x".repeat(summaryLength * overlongFactor);
const redactedAuthLine = 'AUTH_SECRET="[redacted]" is rejected';
const redactedStatement = "Failed query: select 1 from user where name = ?\nparams: [redacted]";

describe.for([
  [
    "a failure nested inside the failure that broke the layer",
    Cause.fail(new LayerFailed({ cause: new LayerFailed({ cause: { message: "select 1" } }) })),
    {
      ...failedAttributes,
      "error.cause": `LayerFailed: \n${pinnedFrame} {\n  [cause]: LayerFailed: \n  ${pinnedFrame} {\n    [cause]: Error: select 1\n  }\n}`,
      "error.chain": "select 1",
      "error.fields": JSON.stringify({
        _tag: "LayerFailed",
        cause: { _tag: "LayerFailed", cause: { message: "select 1" }, stack: pinnedStack },
        stack: pinnedStack,
      }),
      ...reportedEvent,
    },
  ],
  [
    "a cause that broke the layer outright",
    Cause.fail(new LayerFailed({ cause: { message: missingTable } })),
    {
      ...failedAttributes,
      "error.cause": `LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: ${missingTable}\n}`,
      "error.chain": missingTable,
      "error.fields": JSON.stringify({
        _tag: "LayerFailed",
        cause: { message: missingTable },
        stack: pinnedStack,
      }),
      ...reportedEvent,
    },
  ],
  [
    "a long outer message burying the cause that broke the layer",
    Cause.fail(
      new LayerFailed({
        cause: { cause: { message: buriedRootMessage }, message: overlongQuery },
      }),
    ),
    {
      ...failedAttributes,
      "error.cause": `${`LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: ${overlongQuery}`.slice(0, summaryLength)}${truncationMark}`,
      "error.chain": `${`${buriedRootMessage} < ${overlongQuery}`.slice(0, summaryLength)}${truncationMark}`,
      "error.fields": `${JSON.stringify({
        _tag: "LayerFailed",
        cause: { cause: { message: buriedRootMessage }, message: overlongQuery },
        stack: pinnedStack,
      }).slice(0, summaryLength)}${truncationMark}`,
      ...reportedEvent,
    },
  ],
  [
    "a cause JSON cannot carry",
    Cause.fail(new LayerFailed({ cause: { big: 1n } })),
    {
      ...failedAttributes,
      "error.cause": `LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: {"big":"1n"}\n}`,
      "error.chain": "",
      "error.fields": "[unserializable]",
      ...reportedEvent,
    },
  ],
  [
    "a message longer than the summary",
    Cause.fail(new LayerFailed({ cause: { message: overlongMessage } })),
    {
      ...failedAttributes,
      "error.cause": `${`LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: ${overlongMessage}`.slice(0, summaryLength)}${truncationMark}`,
      "error.chain": `${overlongMessage.slice(0, summaryLength)}${truncationMark}`,
      "error.fields": `${JSON.stringify({
        _tag: "LayerFailed",
        cause: { message: overlongMessage },
        stack: pinnedStack,
      }).slice(0, summaryLength)}${truncationMark}`,
      ...reportedEvent,
    },
  ],
  [
    "a secret carried in a message",
    Cause.fail(new LayerFailed({ cause: { message: 'AUTH_SECRET="leaked-value" is rejected' } })),
    {
      ...failedAttributes,
      "error.cause": `LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: ${redactedAuthLine}\n}`,
      "error.chain": redactedAuthLine,
      "error.fields": JSON.stringify({
        _tag: "LayerFailed",
        cause: { message: redactedAuthLine },
        stack: pinnedStack,
      }),
      ...reportedEvent,
    },
  ],
  [
    "a secret carried under a secret key",
    Cause.fail(new LayerFailed({ cause: { AUTH_SECRET: "leaked-value", reason: "too short" } })),
    {
      ...failedAttributes,
      "error.cause": `LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: {"AUTH_SECRET":"[redacted]","reason":"too short"}\n}`,
      "error.chain": "",
      "error.fields": JSON.stringify({
        _tag: "LayerFailed",
        cause: { AUTH_SECRET: "[redacted]", reason: "too short" },
        stack: pinnedStack,
      }),
      ...reportedEvent,
    },
  ],
  [
    "a failed statement wrapping a cookie header, thrown rather than failed",
    Cause.die(
      new LayerFailed({
        cause: {
          cause: { message: `set-cookie: theme=dark; Path=/, template-user.session=${leaked}` },
          message: `Failed query: select 1 from user where name = ?\nparams: alpha,${leaked}`,
        },
      }),
    ),
    {
      ...failedAttributes,
      "error.cause": `LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: Failed query: select 1 from user where name = ?\n  params: [redacted]\n    [cause]: Error: set-cookie: [redacted]\n  }\n}`,
      "error.chain": `set-cookie: [redacted] < ${redactedStatement}`,
      "error.fields": JSON.stringify({
        _tag: "LayerFailed",
        cause: { cause: { message: "set-cookie: [redacted]" }, message: redactedStatement },
        stack: pinnedStack,
      }),
      ...reportedEvent,
    },
  ],
  [
    "query parameters carried under a params key",
    Cause.fail(new LayerFailed({ cause: { params: [leaked], reason: "no such table" } })),
    {
      ...failedAttributes,
      "error.cause": `LayerFailed: \n${pinnedFrame} {\n  [cause]: Error: {"params":"[redacted]","reason":"no such table"}\n}`,
      "error.chain": "",
      "error.fields": JSON.stringify({
        _tag: "LayerFailed",
        cause: { params: "[redacted]", reason: "no such table" },
        stack: pinnedStack,
      }),
      ...reportedEvent,
    },
  ],
] as const)("%s", ([, brokenRuntime, expectedLine]) => {
  const it = test.extend("reportedLogs", async () =>
    recordedLogs((sink) => reportUnavailable(brokenRuntime, { log: sink, service: "wiki" })));

  it("is reported on the failure stream alone, naming what broke the layer", ({ reportedLogs }) => {
    expect(reportedLogs).toStrictEqual({ stderr: [expectedLine], stdout: [], stdwarn: [] });
  });
});
