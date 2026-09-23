import { assert, it } from "@effect/vitest";
import { ADMIN_PERMISSION, AGREEMENT_KIND, APPLICATION, ROLE, httpStatus } from "@repo/config";
import { AgreementRequired, pendingAgreementKinds, requireCurrentAgreements } from "@repo/db";
import { createAgreementDraft, publishAgreementVersion } from "@repo/db/admin";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { DateTime, Effect, Layer, Schema } from "effect";
import { TestClock } from "effect/testing";

import { AgreementsView } from "#shared/contracts/index.ts";
import { memberApi } from "./member-api.ts";
import { memberRequirementLayer } from "./member-requirement-layer.ts";

const routes = { "/api/profile": "profile" };
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const password = "consent-gate-password-123";
const email = "member@example.test";
const adminEmail = "admin@example.test";
const JsonUnknown = Schema.fromJsonString(Schema.Unknown);

const ConsentRequiredBody = Schema.Struct({
  error: Schema.String,
  kinds: Schema.Array(Schema.String),
});

function memberApp() {
  const environment = appEnvironment();
  const runtime = workerRuntime(() => {
    const base = Layer.orDie(appLayer(environment, APPLICATION.user, routes));
    return Layer.mergeAll(
      base,
      Layer.orDie(memberRequirementLayer(environment)).pipe(Layer.provide(base)),
    );
  });
  return { app: memberApi(apiRoutes(runtime, reporting)), runtime };
}

type MemberApp = ReturnType<typeof memberApp>["app"];

class Browser {
  readonly #app: MemberApp;
  readonly #cookies = new Map<string, string>();

  public constructor(app: MemberApp) {
    this.#app = app;
  }

  public call(
    path: string,
    body?: unknown,
    method: "GET" | "POST" = body === undefined ? "GET" : "POST",
  ): Effect.Effect<Response> {
    const app = this.#app;
    const cookies = this.#cookies;
    const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    return Effect.gen(function* sendConsent() {
      const encoded =
        body === undefined ? undefined : yield* Schema.encodeEffect(JsonUnknown)(body);
      const response = yield* Effect.promise(() =>
        Promise.resolve(
          app.fetch(
            new Request(`${fixtureOrigin}${apiRoot}${path}`, {
              headers: {
                "content-type": "application/json",
                cookie,
                origin: fixtureOrigin,
              },
              method,
              ...(encoded === undefined ? {} : { body: encoded }),
            }),
          ),
        ),
      );
      for (const header of response.headers.getSetCookie()) {
        const [pair] = header.split(";");
        const separator = pair?.indexOf("=") ?? -1;
        if (pair !== undefined && separator > 0) {
          const value = pair.slice(separator + 1);
          if (value === "") {
            cookies.delete(pair.slice(0, separator));
          } else {
            cookies.set(pair.slice(0, separator), value);
          }
        }
      }
      return response;
    }).pipe(Effect.orDie);
  }

  public status(path: string, body?: unknown): Effect.Effect<number> {
    return this.call(path, body).pipe(Effect.map((response) => response.status));
  }

  public json(path: string, body?: unknown): Effect.Effect<unknown> {
    return this.call(path, body).pipe(
      Effect.flatMap((response) => Effect.promise(() => response.json() as Promise<unknown>)),
    );
  }
}

const signedInMember = Effect.fn("signedInMember")(function* signedInMember(app: MemberApp) {
  const browser = new Browser(app);
  assert.strictEqual(
    yield* browser.status("/auth/sign-up/email", { email, name: "member", password }),
    httpStatus.ok,
  );
  yield* runStatement("UPDATE user SET email_verified = 1 WHERE email = ?", email);
  assert.strictEqual(
    yield* browser.status("/auth/sign-in/email", { email, password }),
    httpStatus.ok,
  );
  const [row] = (yield* runStatement("SELECT id FROM user WHERE email = ?", email)).results;
  const userId = (yield* Schema.decodeUnknownEffect(Schema.Struct({ id: Schema.String }))(row)).id;
  return { browser, userId };
});

const strongAdminSession = Effect.fn("strongAdminSession")(function* strongAdminSession() {
  const sessionId = crypto.randomUUID();
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
  yield* runStatement(
    "INSERT INTO user (id, email, email_verified, name, role, permission, created_at, updated_at) VALUES ('admin', ?, 1, 'admin', ?, ?, ?, ?)",
    adminEmail,
    ROLE.administrator,
    ADMIN_PERMISSION.owner,
    now,
    now,
  );
  yield* runStatement(
    "INSERT INTO session (id, user_id, token, audience, authentication_method, security_version, created_at, updated_at, expires_at) VALUES (?, 'admin', ?, ?, 'password_totp', 0, ?, ?, ?)",
    sessionId,
    crypto.randomUUID(),
    APPLICATION.admin,
    now,
    now,
    now + 60_000,
  );
  return sessionId;
});

const acceptEverythingPending = Effect.fn("acceptEverythingPending")(
  function* acceptEverythingPending(browser: Browser) {
    const view = yield* Schema.decodeUnknownEffect(AgreementsView)(
      yield* browser.json("/agreements"),
    );
    return yield* Schema.decodeUnknownEffect(AgreementsView)(
      yield* browser.json("/agreements/accept", {
        versionIds: view.pending.map((agreement) => agreement.id),
      }),
    );
  },
);

it.effect(
  "blocks member routes with a consent-required answer after a new terms version is published, until the member accepts it",
  () =>
    Effect.gen(function* program() {
      const { app, runtime } = memberApp();
      const { browser, userId } = yield* signedInMember(app);
      assert.strictEqual(yield* browser.status("/onboarding"), httpStatus.ok);
      assert.strictEqual(yield* browser.status("/profile"), httpStatus.preconditionRequired);
      assert.strictEqual(
        yield* browser.status("/onboarding", { step: "choose" }),
        httpStatus.preconditionRequired,
      );
      const accepted = yield* acceptEverythingPending(browser);
      assert.deepStrictEqual(accepted.pending, []);
      assert.deepStrictEqual(accepted.accepted.map((agreement) => agreement.version).toSorted(), [
        "interview-history-1",
        "privacy-1",
        "terms-1",
      ]);
      assert.strictEqual(yield* browser.status("/profile"), httpStatus.ok);
      assert.strictEqual(yield* browser.status("/onboarding", { step: "choose" }), httpStatus.ok);

      const sessionId = yield* strongAdminSession();
      yield* TestClock.setTime(1_789_862_400_000 + 86_400_000);
      const draft = yield* createAgreementDraft({
        body: "revised terms",
        kind: AGREEMENT_KIND.terms,
        sessionId,
        summary: "料金の記載を追加しました。",
        version: "terms-2",
      });
      yield* publishAgreementVersion({ id: draft.id, sessionId });

      const refused = yield* browser.call("/profile");
      assert.strictEqual(refused.status, httpStatus.preconditionRequired);
      const body = yield* Schema.decodeUnknownEffect(ConsentRequiredBody)(
        yield* Effect.promise(() => refused.json() as Promise<unknown>),
      );
      assert.deepStrictEqual(body.kinds, [AGREEMENT_KIND.terms]);
      assert.strictEqual(yield* browser.status("/home/feed"), httpStatus.preconditionRequired);
      assert.strictEqual(yield* browser.status("/session"), httpStatus.ok);
      assert.strictEqual(yield* browser.status("/onboarding"), httpStatus.ok);
      assert.strictEqual(yield* browser.status("/agreements"), httpStatus.ok);
      assert.deepStrictEqual(yield* pendingAgreementKinds(userId), [AGREEMENT_KIND.terms]);

      const reaccepted = yield* acceptEverythingPending(browser);
      assert.deepStrictEqual(reaccepted.accepted.map((agreement) => agreement.version).toSorted(), [
        "interview-history-1",
        "privacy-1",
        "terms-1",
        "terms-2",
      ]);
      assert.strictEqual(yield* browser.status("/profile"), httpStatus.ok);
      assert.strictEqual(yield* browser.status("/home/feed"), httpStatus.ok);
      yield* Effect.promise(() => Promise.resolve(runtime.dispose()).then(() => undefined));
    }).pipe(Effect.provide(TestDatabase)),
);

it.effect("lets anonymous and public requests through to the route's own answer", () =>
  Effect.gen(function* program() {
    const { app, runtime } = memberApp();
    const browser = new Browser(app);
    assert.strictEqual(yield* browser.status("/profile"), httpStatus.unauthorized);
    assert.strictEqual(yield* browser.status("/agreements"), httpStatus.unauthorized);
    const published = yield* browser.call("/agreements/published?kind=terms");
    assert.strictEqual(published.status, httpStatus.ok);
    assert.strictEqual(
      yield* browser.status("/agreements/published?kind=cookies"),
      httpStatus.badRequest,
    );
    yield* Effect.promise(() => Promise.resolve(runtime.dispose()).then(() => undefined));
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("does not record acceptance of a draft that is not published yet", () =>
  Effect.gen(function* program() {
    const { app, runtime } = memberApp();
    const { browser, userId } = yield* signedInMember(app);
    const sessionId = yield* strongAdminSession();
    yield* TestClock.setTime(1_789_862_400_000 + 86_400_000);
    const draft = yield* createAgreementDraft({
      body: "draft",
      kind: AGREEMENT_KIND.terms,
      sessionId,
      summary: undefined,
      version: "terms-2",
    });
    assert.strictEqual(
      yield* browser.status("/agreements/accept", { versionIds: [draft.id] }),
      httpStatus.notFound,
    );
    assert.deepStrictEqual((yield* pendingAgreementKinds(userId)).toSorted(), [
      AGREEMENT_KIND.interview_history,
      AGREEMENT_KIND.privacy,
      AGREEMENT_KIND.terms,
    ]);
    const failure = yield* Effect.flip(requireCurrentAgreements(userId));
    assert.instanceOf(failure, AgreementRequired);
    yield* Effect.promise(() => Promise.resolve(runtime.dispose()).then(() => undefined));
  }).pipe(Effect.provide(TestDatabase)),
);
