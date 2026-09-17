import { describe, expect, it } from "vite-plus/test";
import { isLocalDevelopmentOrigin, readEnvironment } from "./index.ts";
import { ValiError } from "valibot";

const local = {
  APP_ORIGIN: "http://localhost:3001",
  AUTH_SECRET: "test-environment-secret-not-for-any-deployment",
  EMAIL_FROM: "sender@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};

describe("local development origins", () => {
  it("treats only loopback and HTTPS LAN hosts as local development", () => {
    expect.hasAssertions();
    const lan = readEnvironment({ ...local, APP_ORIGIN: "https://template-user.local" });
    expect({ local: lan.local }).toStrictEqual({ local: true });
    expect(() => readEnvironment({ ...local, APP_ORIGIN: "http://template-user.local" })).toThrow(
      "HTTPS is required outside localhost",
    );
    const publicOrigins = [
      "https://local",
      "https://user.template.local.example.test",
      "https://mac-mini.tail2ee823.ts.net",
      "https://app.example.test",
    ];
    expect(publicOrigins.filter((origin) => isLocalDevelopmentOrigin(origin))).toStrictEqual([]);
  });

  it("validates local configuration and defaults the release to local", () => {
    expect.hasAssertions();
    const result = readEnvironment(local);
    expect({ local: result.local, release: result.APP_RELEASE }).toStrictEqual({
      local: true,
      release: "local",
    });
    expect(() => readEnvironment({ ...local, APP_RELEASE: "private@example.com" })).toThrow(
      ValiError,
    );
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

  it("rejects weak session secrets and pathful or unparsable application origins", () => {
    expect.hasAssertions();
    expect(() => readEnvironment({ ...local, AUTH_SECRET: "weak" })).toThrow("32");
    expect(() => readEnvironment({ ...local, APP_ORIGIN: "http://localhost:3001/path" })).toThrow(
      "An origin without a path is required",
    );
    expect(() => readEnvironment({ ...local, APP_ORIGIN: "not-a-url" })).toThrow(ValiError);
  });
});
