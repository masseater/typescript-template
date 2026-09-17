import * as v from "valibot";
import { expect, test } from "vitest";
import { isLocalDevelopmentOrigin, readEnvironment } from "./index.ts";

const local = {
  APP_ORIGIN: "http://localhost:3001",
  AUTH_SECRET: "test-environment-secret-not-for-any-deployment",
  EMAIL_FROM: "sender@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};

test("validates local configuration and defaults the release to local", () => {
  const result = readEnvironment(local);
  expect(result.local).toBe(true);
  expect(result.APP_RELEASE).toBe("local");
  expect(() => readEnvironment({ ...local, APP_RELEASE: "private@example.com" })).toThrow(
    v.ValiError,
  );
});

test("rejects Mailpit for public application origins", () => {
  expect(() => readEnvironment({ ...local, APP_ORIGIN: "https://app.example.test" })).toThrow(
    "Mailpit is restricted to local development",
  );
});

test("treats only loopback and HTTPS tailnet hosts as local development", () => {
  expect(
    readEnvironment({ ...local, APP_ORIGIN: "https://mac-mini.tail2ee823.ts.net:3001" }).local,
  ).toBe(true);
  expect(() =>
    readEnvironment({ ...local, APP_ORIGIN: "http://mac-mini.tail2ee823.ts.net:3001" }),
  ).toThrow("HTTPS is required outside localhost");
  for (const origin of [
    "https://ts.net",
    "https://example.ts.net",
    "https://mac-mini.tail2ee823.ts.net.example.test",
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
  expect(() => readEnvironment({ ...local, APP_ORIGIN: "not-a-url" })).toThrow(v.ValiError);
});
