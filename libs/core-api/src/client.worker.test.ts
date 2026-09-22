import { checkDatabase, type Database, type DatabaseFailure } from "@repo/db";
import { AgreementVersionUnavailable, AgreementWithdrawalUnavailable } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect, Layer } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { EmailVerificationFailed } from "./account-rpcs.ts";
import { makeCoreClient } from "./client.ts";
import { withForwardedCookies } from "./forward-cookies.ts";
import { MemberRpcs } from "./member-rpcs.ts";
import { MemberProfileNotFound } from "./member-session-rpcs.ts";
import { createRpcFetcher } from "./serve.ts";
import { SessionIdentity, SessionIdentityMiddleware, SessionRequired } from "./session-identity.ts";

const sessionlessHandlers = MemberRpcs.toLayer({
  acceptAgreements: () => Effect.succeed({ accepted: [], pending: [] }),
  databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
    checkDatabase().pipe(Effect.as(true)),
  getMemberProfile: () =>
    Effect.gen(function* getMemberProfile() {
      yield* SessionIdentity;
      return yield* new MemberProfileNotFound();
    }),
  getSession: () => SessionIdentity,
  listAgreements: () => Effect.succeed({ accepted: [], pending: [] }),
  publishedAgreement: () => Effect.fail(new AgreementVersionUnavailable()),
  requireCurrentAgreements: () => Effect.void,
  updateMemberProfile: () =>
    Effect.gen(function* updateMemberProfile() {
      yield* SessionIdentity;
      return yield* new MemberProfileNotFound();
    }),
  verifyEmail: () => Effect.fail(new EmailVerificationFailed({ rateLimited: false })),
  withdrawAgreement: () => Effect.fail(new AgreementWithdrawalUnavailable()),
});

const sessionlessMiddleware = Layer.succeed(SessionIdentityMiddleware, () =>
  Effect.fail(new SessionRequired()),
);

describe("makeCoreClient", () => {
  const it = test.extend("databaseReady", () => {
    const handlerLayer = Layer.mergeAll(sessionlessHandlers, sessionlessMiddleware).pipe(
      Layer.provide(TestDatabase),
    );
    const rpcFetch = createRpcFetcher(MemberRpcs, handlerLayer).fetch;
    const core: Fetcher = {
      connect: (): never => Effect.runSync(Effect.die(new Error("Core RPC does not open sockets"))),
      fetch: (input, init) => rpcFetch(new Request(input, init)),
    };
    return Effect.runPromise(
      Effect.gen(function* program() {
        const client = yield* makeCoreClient(MemberRpcs, core);
        return yield* client.databaseReady({});
      }).pipe(Effect.scoped),
    );
  });

  it("round-trips over Effect RPC with real D1", ({ databaseReady }) => {
    expect(databaseReady).toStrictEqual(true);
  });
});

describe("withForwardedCookies", () => {
  const it = test.extend("refusal", () => {
    const handlerLayer = Layer.mergeAll(sessionlessHandlers, sessionlessMiddleware).pipe(
      Layer.provide(TestDatabase),
    );
    const rpcFetch = createRpcFetcher(MemberRpcs, handlerLayer).fetch;
    const core: Fetcher = {
      connect: (): never => Effect.runSync(Effect.die(new Error("Core RPC does not open sockets"))),
      fetch: (input, init) => rpcFetch(new Request(input, init)),
    };
    return Effect.runPromise(
      Effect.gen(function* program() {
        const client = yield* makeCoreClient(MemberRpcs, core);
        return yield* client
          .getSession({})
          .pipe(
            withForwardedCookies(
              new Headers({ cookie: "template-service-member.session_token=x" }),
            ),
            Effect.flip,
          );
      }).pipe(Effect.scoped),
    );
  });

  it("forwards cookies into session RPC and surfaces SessionRequired", ({ refusal }) => {
    expect(refusal).toStrictEqual(new SessionRequired());
  });
});
