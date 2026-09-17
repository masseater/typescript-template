import { describe, expect, it } from "vitest";
import { isLocalDevelopmentOrigin, readEnvironment } from "./index.ts";

const local = {
  APP_ORIGIN: "http://localhost:3001",
  AUTH_SECRET: "test-environment-secret-not-for-any-deployment",
  EMAIL_FROM: "sender@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
};

describe("local development origins", () => {
  it("treats only loopback and HTTPS tailnet hosts as local development", () => {
    expect.hasAssertions();
    const tailnet = readEnvironment({
      ...local,
      APP_ORIGIN: "https://mac-mini.tail2ee823.ts.net:3001",
    });
    expect({ local: tailnet.local }).toStrictEqual({ local: true });
    expect(() =>
      readEnvironment({ ...local, APP_ORIGIN: "http://mac-mini.tail2ee823.ts.net:3001" }),
    ).toThrow("HTTPS is required outside localhost");
    const publicOrigins = [
      "https://ts.net",
      "https://example.ts.net",
      "https://mac-mini.tail2ee823.ts.net.example.test",
      "https://app.example.test",
    ];
    expect(publicOrigins.filter((origin) => isLocalDevelopmentOrigin(origin))).toStrictEqual([]);
  });
});

describe("application origins and secrets", () => {
  it("rejects Mailpit for public application origins", () => {
    expect.hasAssertions();
    expect(() => readEnvironment({ ...local, APP_ORIGIN: "https://app.example.test" })).toThrow(
      "Mailpit is restricted to local development",
    );
  });

  it("requires HTTPS for non-local origins", () => {
    expect.hasAssertions();
    expect(() => readEnvironment({ ...local, APP_ORIGIN: "http://app.example.test" })).toThrow(
      "HTTPS is required outside localhost",
    );
  });

  it("rejects weak session secrets and pathful application origins", () => {
    expect.hasAssertions();
    expect(() => readEnvironment({ ...local, AUTH_SECRET: "weak" })).toThrow("32");
    expect(() => readEnvironment({ ...local, APP_ORIGIN: "http://localhost:3001/path" })).toThrow(
      "An origin without a path is required",
    );
  });
});

describe("exporter headers", () => {
  it("validates local configuration and exporter header structure", () => {
    expect.hasAssertions();
    const result = readEnvironment({
      ...local,
      OTEL_EXPORTER_OTLP_HEADERS: JSON.stringify({ authorization: "test-only" }),
    });
    expect({ local: result.local, otelHeaders: result.otelHeaders }).toStrictEqual({
      local: true,
      otelHeaders: { authorization: "test-only" },
    });
  });

  it("rejects non-string exporter credential values", () => {
    expect.hasAssertions();
    expect(() =>
      readEnvironment({
        ...local,
        OTEL_EXPORTER_OTLP_HEADERS: JSON.stringify({ authorization: 42 }),
      }),
    ).toThrow("string");
  });
});

describe("sentry settings", () => {
  it("requires explicit environment and release when Sentry delivery is enabled", () => {
    expect.hasAssertions();
    expect(readEnvironment(local).sentry).toBeUndefined();
    const dsn = "https://public-key@sentry.example.test/1";
    expect(() => readEnvironment({ ...local, SENTRY_DSN: dsn })).toThrow("string");
    expect(
      readEnvironment({
        ...local,
        SENTRY_DSN: dsn,
        SENTRY_ENVIRONMENT: "preview",
        SENTRY_RELEASE: "test-1",
      }).sentry,
    ).toStrictEqual({ dsn, environment: "preview", release: "test-1" });
  });
});
