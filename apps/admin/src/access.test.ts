import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { enforceAdminAccess, localAccessCookie } from "./access.ts";

for (const pathname of ["/", "/login", "/api/users", "/assets/admin.js", "/assets/admin.js.map"])
  it.effect(`protects ${pathname} before application delivery`, () =>
    Effect.gen(function* () {
      const response = yield* enforceAdminAccess(new Request(`http://localhost:3002${pathname}`), {
        APP_ORIGIN: "http://localhost:3002",
        LOCAL_ADMIN_USER: "operator",
        LOCAL_ADMIN_PASSWORD: crypto.randomUUID(),
      });
      assert.strictEqual(response?.status, 401);
      assert.strictEqual(
        yield* Effect.promise(async () => response?.text()),
        "Authentication required",
      );
    }),
  );

it.effect("accepts only the configured local entry credentials and origin", () =>
  Effect.gen(function* () {
    const password = crypto.randomUUID();
    const env = {
      APP_ORIGIN: "http://localhost:3002",
      LOCAL_ADMIN_USER: "operator",
      LOCAL_ADMIN_PASSWORD: password,
    };
    const headers = { authorization: `Basic ${btoa(`operator:${password}`)}` };
    assert.isNull(
      yield* enforceAdminAccess(new Request("http://localhost:3002/login", { headers }), env),
    );
    assert.strictEqual(
      (yield* enforceAdminAccess(new Request("http://127.0.0.1:3002/login", { headers }), env))
        ?.status,
      401,
    );
    assert.strictEqual(
      (yield* enforceAdminAccess(
        new Request("http://localhost:3002/login", {
          headers: { authorization: `Basic ${btoa("operator:wrong")}` },
        }),
        env,
      ))?.status,
      401,
    );
  }),
);

it.effect("local entry cookie issued after credentials admits requests without credentials", () =>
  Effect.gen(function* () {
    const password = crypto.randomUUID();
    const env = {
      APP_ORIGIN: "http://localhost:3002",
      LOCAL_ADMIN_USER: "operator",
      LOCAL_ADMIN_PASSWORD: password,
    };
    const cookie = yield* localAccessCookie(env);
    assert.match(cookie ?? "", /^local-admin-gate=[\w-]+; Path=\/; HttpOnly; SameSite=Strict$/);
    assert.notInclude(cookie ?? "", password);
    const value = cookie?.split(";", 1)[0] ?? "";
    assert.isNull(
      yield* enforceAdminAccess(
        new Request("http://localhost:3002/api/telemetry", {
          headers: { cookie: `a=b; ${value}` },
        }),
        env,
      ),
    );
    const otherPassword = yield* localAccessCookie({
      ...env,
      LOCAL_ADMIN_PASSWORD: crypto.randomUUID(),
    });
    assert.strictEqual(
      (yield* enforceAdminAccess(
        new Request("http://localhost:3002/api/telemetry", {
          headers: { cookie: otherPassword?.split(";", 1)[0] ?? "" },
        }),
        env,
      ))?.status,
      401,
    );
    assert.isNull(yield* localAccessCookie({ APP_ORIGIN: "https://admin.example.test" }));
  }),
);

it.effect("does not enable the local entry gate for a production domain", () =>
  Effect.gen(function* () {
    const failure = yield* enforceAdminAccess(new Request("https://admin.example.test/login"), {
      APP_ORIGIN: "https://admin.example.test",
      LOCAL_ADMIN_USER: "operator",
      LOCAL_ADMIN_PASSWORD: crypto.randomUUID(),
    }).pipe(Effect.flip);
    assert.strictEqual(failure.field, "ACCESS_ISSUER");
  }),
);

it.effect("requires a Cloudflare Access assertion in production", () =>
  Effect.gen(function* () {
    const response = yield* enforceAdminAccess(
      new Request("https://admin.example.test/assets/admin.js"),
      {
        APP_ORIGIN: "https://admin.example.test",
        ACCESS_ISSUER: "https://template.cloudflareaccess.com",
        ACCESS_AUD: "application-audience",
      },
    );
    assert.strictEqual(response?.status, 401);
  }),
);
