import { expect, test } from "vitest";
import { isLocalDevelopmentOrigin, readEnvironment } from "./index.ts";

const local = {
  APP_ORIGIN: "http://localhost:3001",
  AUTH_SECRET: "test-environment-secret-not-for-any-deployment",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
  EMAIL_FROM: "sender@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};

test("validates local configuration and exporter header structure", () => {
  const result = readEnvironment({
    ...local,
    OTEL_EXPORTER_OTLP_HEADERS: JSON.stringify({ authorization: "test-only" }),
  });
  expect(result.local).toBe(true);
  expect(result.otelHeaders).toEqual({ authorization: "test-only" });
});

test("rejects Mailpit for public application origins", () => {
  expect(() => readEnvironment({ ...local, APP_ORIGIN: "https://app.example.test" })).toThrow(
    "Mailpit is restricted to local development",
  );
});

test("treats only loopback and HTTPS LAN hosts as local development", () => {
  expect(readEnvironment({ ...local, APP_ORIGIN: "https://template-user.local" }).local).toBe(true);
  expect(() => readEnvironment({ ...local, APP_ORIGIN: "http://template-user.local" })).toThrow(
    "HTTPS is required outside localhost",
  );
  for (const origin of [
    "https://local",
    "https://user.template.local.example.test",
    "https://mac-mini.tail2ee823.ts.net",
    "https://app.example.test",
  ])
    expect(isLocalDevelopmentOrigin(origin)).toBe(false);
});

test("requires HTTPS for non-local origins", () => {
  expect(() => readEnvironment({ ...local, APP_ORIGIN: "http://app.example.test" })).toThrow(
    "HTTPS is required outside localhost",
  );
});

test("rejects weak session secrets and pathful application origins", () => {
  expect(() => readEnvironment({ ...local, AUTH_SECRET: "weak" })).toThrow("32");
  expect(() => readEnvironment({ ...local, APP_ORIGIN: "http://localhost:3001/path" })).toThrow(
    "An origin without a path is required",
  );
});

test("rejects non-string exporter credential values", () => {
  expect(() =>
    readEnvironment({
      ...local,
      OTEL_EXPORTER_OTLP_HEADERS: JSON.stringify({ authorization: 42 }),
    }),
  ).toThrow("string");
});

test("requires explicit environment and release when Sentry delivery is enabled", () => {
  expect(readEnvironment(local).sentry).toBeNull();
  const dsn = "https://public-key@sentry.example.test/1";
  expect(() => readEnvironment({ ...local, SENTRY_DSN: dsn })).toThrow("string");
  expect(
    readEnvironment({
      ...local,
      SENTRY_DSN: dsn,
      SENTRY_ENVIRONMENT: "preview",
      SENTRY_RELEASE: "test-1",
    }).sentry,
  ).toEqual({ dsn, environment: "preview", release: "test-1" });
});
