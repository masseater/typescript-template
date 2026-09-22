import { authTest, authTestSecret, registerVerified, runWith, signInAs } from "@repo/auth/testing";
import { APPLICATION, ROLE } from "@repo/config";
import {
  MemberRpcs,
  SessionRequired,
  createRpcFetcher,
  isAuthForwardPath,
  makeCoreClient,
  withForwardedCookies,
} from "@repo/core-api";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { handleForwardedAuth } from "./auth-layer.ts";
import { memberHandlers } from "./handlers.ts";

import type { CoreBindings } from "./bindings.ts";

const coreBindings = (): CoreBindings => ({
  AUTH_SECRET: authTestSecret,
  DB: env.DB,
  EMAIL: {
    send: (): Promise<{ success: true }> => Promise.resolve({ success: true }),
  } as unknown as SendEmail,
  EMAIL_FROM: "sender@example.test",
});

const memberCore = (): Fetcher => {
  const rpcFetch = createRpcFetcher(MemberRpcs, memberHandlers(coreBindings())).fetch;
  return {
    connect: (): never => {
      throw new Error("Core RPC does not open sockets");
    },
    fetch: (input, init) => rpcFetch(new Request(input, init)),
  };
};

describe("auth forward paths", () => {
  const cases = [
    ["/api/auth/ok", true],
    ["/api/auth", true],
    ["/.well-known/oauth-authorization-server", true],
    ["/session", false],
  ] as const;

  for (const [pathname, expected] of cases) {
    test(`${pathname} → ${String(expected)}`, () => {
      expect(isAuthForwardPath(pathname)).toBe(expected);
    });
  }
});

describe("memberHandlers session RPC", () => {
  const it = authTest()
    .extend("signedIn", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* signedIn() {
          yield* registerVerified("member@example.com");
          return yield* signInAs(APPLICATION.user, "member@example.com");
        }),
      ),
    )
    .extend("session", ({ signedIn }) =>
      Effect.runPromise(
        Effect.gen(function* sessionRpc() {
          const client = yield* makeCoreClient(MemberRpcs, memberCore());
          return yield* client.getSession({}).pipe(withForwardedCookies(signedIn.cookieHeaders()));
        }).pipe(Effect.scoped),
      ),
    )
    .extend("profile", ({ signedIn }) =>
      Effect.runPromise(
        Effect.gen(function* profileRpc() {
          const client = yield* makeCoreClient(MemberRpcs, memberCore());
          return yield* client
            .getMemberProfile({})
            .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        }).pipe(Effect.scoped),
      ),
    )
    .extend("updated", ({ signedIn }) =>
      Effect.runPromise(
        Effect.gen(function* updateRpc() {
          const client = yield* makeCoreClient(MemberRpcs, memberCore());
          return yield* client
            .updateMemberProfile({
              name: "Renamed",
              profile: "hello",
              socialLinks: ["https://example.test"],
            })
            .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        }).pipe(Effect.scoped),
      ),
    )
    .extend("anonymous", () =>
      Effect.runPromise(
        Effect.gen(function* anonymousRpc() {
          const client = yield* makeCoreClient(MemberRpcs, memberCore());
          return yield* client.getSession({}).pipe(Effect.flip);
        }).pipe(Effect.scoped),
      ),
    );

  it("resolves the signed-in member over cookie-forwarded RPC", ({ session }) => {
    expect(session).toMatchObject({
      strong: false,
      user: {
        email: "member@example.com",
        name: "member@example.com",
        permission: null,
        role: ROLE.member,
        twoFactorEnabled: false,
      },
    });
    expect(session.session.id.length).toBeGreaterThan(0);
    expect(session.user.id.length).toBeGreaterThan(0);
  });

  it("reads the member profile for the session identity", ({ profile }) => {
    expect(profile).toMatchObject({
      email: "member@example.com",
      name: "member@example.com",
      profile: "",
      socialLinks: [],
    });
  });

  it("updates the member profile through core", ({ updated }) => {
    expect(updated).toMatchObject({
      email: "member@example.com",
      name: "Renamed",
      profile: "hello",
      socialLinks: ["https://example.test"],
    });
  });

  it("rejects anonymous session RPC", ({ anonymous }) => {
    expect(anonymous).toStrictEqual(new SessionRequired());
  });
});

describe("handleForwardedAuth", () => {
  const it = authTest().extend("ok", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* okEndpoint() {
        const response = yield* handleForwardedAuth(
          coreBindings(),
          APPLICATION.user,
          new Request("http://127.0.0.1:3001/api/auth/ok", { method: "GET" }),
        );
        return response.status;
      }),
    ),
  );

  it("serves better-auth through the core auth proxy", ({ ok }) => {
    expect(ok).toBe(200);
  });
});

describe("memberHandlers agreement RPC", () => {
  const it = authTest()
    .extend("signedIn", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* signedIn() {
          yield* registerVerified("agreements@example.com");
          return yield* signInAs(APPLICATION.user, "agreements@example.com");
        }),
      ),
    )
    .extend("listed", ({ signedIn }) =>
      Effect.runPromise(
        Effect.gen(function* listRpc() {
          const client = yield* makeCoreClient(MemberRpcs, memberCore());
          return yield* client
            .listAgreements({})
            .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        }).pipe(Effect.scoped),
      ),
    )
    .extend("accepted", ({ signedIn, listed }) =>
      Effect.runPromise(
        Effect.gen(function* acceptRpc() {
          const client = yield* makeCoreClient(MemberRpcs, memberCore());
          return yield* client
            .acceptAgreements({ versionIds: listed.pending.map((agreement) => agreement.id) })
            .pipe(withForwardedCookies(signedIn.cookieHeaders()));
        }).pipe(Effect.scoped),
      ),
    )
    .extend("published", () =>
      Effect.runPromise(
        Effect.gen(function* publishedRpc() {
          const client = yield* makeCoreClient(MemberRpcs, memberCore());
          return yield* client.publishedAgreement({ kind: "terms" });
        }).pipe(Effect.scoped),
      ),
    );

  it("lists seeded pending agreements for the signed-in member", ({ listed }) => {
    expect(listed.pending.map((agreement) => agreement.kind).toSorted()).toEqual([
      "interview_history",
      "privacy",
      "terms",
    ]);
    expect(listed.accepted).toEqual([]);
  });

  it("accepts pending agreements through core", ({ accepted }) => {
    expect(accepted.pending).toEqual([]);
    expect(accepted.accepted.map((agreement) => agreement.kind).toSorted()).toEqual([
      "interview_history",
      "privacy",
      "terms",
    ]);
  });

  it("reads the published terms agreement without a session", ({ published }) => {
    expect(published).toMatchObject({ kind: "terms", version: "terms-1" });
    expect(published.body.length).toBeGreaterThan(0);
  });
});
