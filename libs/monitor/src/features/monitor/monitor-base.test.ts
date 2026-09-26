import { Cause, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { checkFailedRecord } from "./monitor-base.ts";

class UpstreamFailed extends Schema.TaggedError<UpstreamFailed>()("UpstreamFailed", {
  cause: Schema.Unknown,
  code: Schema.String,
  status: Schema.Finite,
}) {
  public override readonly stack = "UpstreamFailed: \n    at fetchPage";
}

describe("a check that failed on an HTTP answer", () => {
  const it = test.extend("record", () =>
    checkFailedRecord({
      cause: Cause.fail(
        new UpstreamFailed({
          cause: Object.create(TypeError.prototype, {
            message: { value: "operator@example.test at 198.51.100.4 was throttled" },
            stack: {
              value: "TypeError: operator@example.test at 198.51.100.4 was throttled\n    at relay",
            },
          }),
          code: "telemetry_http_failed",
          status: 503,
        }),
      ),
      durationMs: 12,
      monitorEvent: "error_monitor",
    }));

  it("records the status, the chain of causes and the reason, minus the personal values", ({
    record,
  }) => {
    expect(record).toStrictEqual({
      durationMs: 12,
      "error.cause": [
        "UpstreamFailed: ",
        "    at fetchPage {",
        "  [cause]: TypeError: [redacted] at [redacted] was throttled",
        "      at relay",
        "}",
      ].join("\n"),
      "error.fields": JSON.stringify({ code: "telemetry_http_failed", status: 503 }),
      event: "error_monitor.check_failed",
      reason: "UpstreamFailed.telemetry_http_failed",
    });
  });
});
