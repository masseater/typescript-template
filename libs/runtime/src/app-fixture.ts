import { Auth, handleAuthRequest, verifySession } from "@repo/auth";
import { APPLICATION, type Application } from "@repo/config";
import {
  AdminRpcs,
  InternalRpcs,
  MemberProfileNotFound,
  MemberRpcs,
  SessionIdentity,
  SessionIdentityMiddleware,
  SessionInvalid,
  SessionRequired,
  createRpcFetcher,
  isAuthForwardPath,
  type SessionIdentityView,
} from "@repo/core-api";
import { checkDatabase, Database, type DatabaseFailure } from "@repo/db";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";

import { appLayer } from "./bindings.ts";
import { workerRuntime } from "./worker-runtime.ts";

import type { SendEmail } from "@cloudflare/workers-types";
import type * as HttpHeaders from "effect/unstable/http/Headers";
import type { AppServices } from "./index.ts";
import type { WorkerRuntime } from "./worker-runtime.ts";

const fixtureOrigin = "http://localhost:3001";
const fixtureAuthSecret = "worker-test-secret-at-least-32-characters";

const webHeaders = (headers: HttpHeaders.Headers): Headers => new Headers(headers);

const envEmail = (): SendEmail | undefined => {
  const email = Reflect.get(env, "EMAIL");
  return typeof email === "object" &&
    email !== null &&
    typeof Reflect.get(email, "send") === "function"
    ? (email as SendEmail)
    : undefined;
};

const authLayerFor = (
  audience: Application,
  origin: string,
  secret: string,
  database: D1Database,
) => {
  const email = envEmail();
  return Auth.layer({
    audience,
    baseURL: origin,
    mail: {
      APP_ORIGIN: origin,
      ...(email === undefined ? {} : { EMAIL: email }),
      EMAIL_FROM: "sender@example.test",
    },
    secret,
  }).pipe(Layer.provideMerge(Database.layer(database)), Layer.orDie);
};

const sessionIdentity = (
  headers: HttpHeaders.Headers,
): Effect.Effect<
  typeof SessionIdentityView.Type,
  SessionRequired | SessionInvalid,
  Auth | Database
> =>
  verifySession(webHeaders(headers), true).pipe(
    Effect.catchTags({
      AdminMfaRequired: (failure) => Effect.die(failure),
      AdminRequired: (failure) => Effect.die(failure),
      DatabaseFailure: (failure) => Effect.die(failure),
      SessionInvalid: () => Effect.fail(new SessionInvalid()),
      SessionRequired: () => Effect.fail(new SessionRequired()),
    }),
  );

const sessionMiddleware = (
  audience: Application,
  origin: string,
  secret: string,
  database: D1Database,
): Layer.Layer<SessionIdentityMiddleware> => {
  const auth = authLayerFor(audience, origin, secret, database);
  return Layer.succeed(SessionIdentityMiddleware, (handler, { headers }) =>
    sessionIdentity(headers).pipe(
      Effect.flatMap((identity) => Effect.provideService(handler, SessionIdentity, identity)),
      Effect.provide(auth),
    ),
  );
};

const rpcFetcherFor = (
  audience: Application,
  database: D1Database,
  origin: string,
  secret: string,
) => {
  const databaseLayer = Database.layer(database);
  const middleware = sessionMiddleware(audience, origin, secret, database);
  switch (audience) {
    case APPLICATION.admin:
      return createRpcFetcher(
        AdminRpcs,
        Layer.mergeAll(
          AdminRpcs.toLayer({
            getSession: () => SessionIdentity,
            ready: (): Effect.Effect<boolean> => Effect.succeed(true),
          }),
          middleware,
        ).pipe(Layer.provide(databaseLayer)),
      );
    case APPLICATION.wiki:
      return createRpcFetcher(
        InternalRpcs,
        Layer.mergeAll(
          InternalRpcs.toLayer({
            getSession: () => SessionIdentity,
            ready: (): Effect.Effect<boolean> => Effect.succeed(true),
          }),
          middleware,
        ).pipe(Layer.provide(databaseLayer)),
      );
    case APPLICATION.user:
      return createRpcFetcher(
        MemberRpcs,
        Layer.mergeAll(
          MemberRpcs.toLayer({
            databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
              checkDatabase().pipe(Effect.as(true)),
            getMemberProfile: () =>
              Effect.gen(function* getMemberProfile() {
                yield* SessionIdentity;
                return yield* new MemberProfileNotFound();
              }),
            getSession: () => SessionIdentity,
            updateMemberProfile: () =>
              Effect.gen(function* updateMemberProfile() {
                yield* SessionIdentity;
                return yield* new MemberProfileNotFound();
              }),
          }),
          middleware,
        ).pipe(Layer.provide(databaseLayer)),
      );
  }
};

const testCoreFetcher = (
  audience: Application,
  origin: string,
  secret: string,
  database: D1Database = env.DB,
): Fetcher => {
  const rpc = rpcFetcherFor(audience, database, origin, secret);
  const auth = authLayerFor(audience, origin, secret, database);
  return {
    connect: (): never => {
      throw new Error("Core RPC does not open sockets");
    },
    fetch: (input, init): Promise<Response> => {
      const request = new Request(input, init);
      if (isAuthForwardPath(new URL(request.url).pathname)) {
        return Effect.runPromise(
          handleAuthRequest(request).pipe(Effect.provide(auth), Effect.orDie),
        );
      }
      return rpc.fetch(request);
    },
  };
};

function appEnvironment(
  overrides: Readonly<Record<string, unknown>> = {},
  audience: Application = APPLICATION.user,
): Record<string, unknown> {
  const origin =
    typeof overrides["APP_ORIGIN"] === "string" ? overrides["APP_ORIGIN"] : fixtureOrigin;
  const secret =
    typeof overrides["AUTH_SECRET"] === "string" ? overrides["AUTH_SECRET"] : fixtureAuthSecret;
  const core =
    overrides["CORE"] === undefined ? testCoreFetcher(audience, origin, secret) : overrides["CORE"];
  return {
    ...env,
    APP_ORIGIN: fixtureOrigin,
    APP_RELEASE: "test",
    ASSETS: { fetch: (): Promise<Response> => Promise.resolve(new Response(undefined)) },
    AUTH_SECRET: fixtureAuthSecret,
    EMAIL_FROM: "sender@example.test",
    OPS_EMAIL: "ops@example.test",
    STRIPE_PRICE_ID: "price_TestMonthly",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_testsecret",
    ...overrides,
    CORE: core,
  };
}

function testClockRuntime(
  routes: Readonly<Record<string, string>>,
): WorkerRuntime<AppServices | TestClock.TestClock, never> {
  const services = Layer.orDie(appLayer(appEnvironment(), "service-member", routes));
  return workerRuntime(() => Layer.merge(services, TestClock.layer()));
}

export { appEnvironment, fixtureAuthSecret, fixtureOrigin, testClockRuntime, testCoreFetcher };
