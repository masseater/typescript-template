import { assert, it } from "@effect/vitest";
import { isLocalDevelopmentOrigin, readEnvironment } from "./index.ts";
import { Effect } from "effect";

const local = {
  APP_ORIGIN: "http://localhost:3001",
  AUTH_SECRET: "test-environment-secret-not-for-any-deployment",
  EMAIL_FROM: "sender@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};

function reason(
  input: unknown,
): Effect.Effect<string, Effect.Success<ReturnType<typeof readEnvironment>>> {
  return readEnvironment(input).pipe(
    Effect.flip,
    Effect.map((error) => error.reason),
  );
}

it.effect("validates local configuration and defaults the release to local", () =>
  Effect.gen(function* program() {
    const result = yield* readEnvironment(local);
    assert.strictEqual(result.local, true);
    assert.strictEqual(result.APP_RELEASE, "local");
    assert.include(yield* reason({ ...local, APP_RELEASE: "private@example.com" }), "APP_RELEASE");
  }),
);

it.effect("rejects Mailpit for public application origins", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* reason({ ...local, APP_ORIGIN: "https://app.example.test" }),
      "Mailpit is restricted to local development",
    );
  }),
);

it.effect("treats only loopback and HTTPS LAN hosts as local development", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      (yield* readEnvironment({ ...local, APP_ORIGIN: "https://template-user.local" })).local,
      true,
    );
    assert.strictEqual(
      yield* reason({ ...local, APP_ORIGIN: "http://template-user.local" }),
      "HTTPS is required outside localhost",
    );
    for (const origin of [
      "https://local",
      "https://user.template.local.example.test",
      "https://app.example.ts.net",
      "https://app.example.test",
    ]) {
      assert.strictEqual(isLocalDevelopmentOrigin(origin), false);
    }
  }),
);

it.effect("requires HTTPS for non-local origins", () =>
  Effect.gen(function* program() {
    const { MAILPIT_URL: _mailpit, ...remote } = local;
    assert.strictEqual(
      yield* reason({ ...remote, APP_ORIGIN: "http://app.example.test" }),
      "HTTPS is required outside localhost",
    );
  }),
);

it.effect("rejects weak session secrets and pathful application origins", () =>
  Effect.gen(function* program() {
    assert.include(yield* reason({ ...local, AUTH_SECRET: "weak" }), "32");
    assert.include(
      yield* reason({ ...local, APP_ORIGIN: "http://localhost:3001/path" }),
      "An origin without a path is required",
    );
    assert.include(yield* reason({ ...local, APP_ORIGIN: "not-a-url" }), "absolute URL");
  }),
);
