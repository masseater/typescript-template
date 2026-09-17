import { describe, expect, it } from "vitest";
import { sentryBoundary } from "./sentry.ts";

const privateEvent = {
  exception: {
    values: [
      {
        stacktrace: {
          frames: [
            {
              filename: "https://example.test/assets/app.js?token=secret",
              lineno: 12,
              pre_context: ["secret"],
              vars: { password: "secret" },
            },
          ],
        },
        type: "TypeError",
        value: "secret",
      },
    ],
  },
  extra: { password: "secret" },
  message: "private@example.test",
  request: { cookies: { session: "secret" }, url: "https://example.test/?token=secret" },
  type: undefined,
  user: { email: "private@example.test" },
};

describe("sentry boundary", () => {
  it("enables configured delivery while stripping private event fields", () => {
    expect.hasAssertions();
    const config = sentryBoundary({
      dsn: "https://public-key@sentry.example.com/1",
      environment: "local",
      release: "test-1",
    });
    expect(config).toMatchObject({ enabled: true, sendDefaultPii: false });
    const sanitized = config.beforeSend(privateEvent);
    expect(JSON.stringify(sanitized)).not.toMatch(/secret|private@example/u);
    expect(sanitized?.exception?.values?.[0]).toMatchObject({
      stacktrace: { frames: [{ lineno: 12 }] },
      type: "TypeError",
    });
    expect(config.beforeSendTransaction()).toBeNull();
    expect(config.beforeBreadcrumb()).toBeNull();
  });

  it("rejects DSNs carrying credentials", () => {
    expect.hasAssertions();
    expect(() =>
      sentryBoundary({
        dsn: "https://user:secret@example.com/1",
        environment: "local",
        release: "test",
      }),
    ).toThrow("DSN");
  });

  it("without a DSN does not enable external delivery", () => {
    expect.hasAssertions();
    const config = sentryBoundary({ environment: "local", release: "test" });
    expect(config).toMatchObject({ enabled: false });
    expect(config.beforeSend({ type: undefined })).toBeNull();
  });
});
