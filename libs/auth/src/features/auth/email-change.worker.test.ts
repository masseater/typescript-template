import { APPLICATION, httpStatus } from "@repo/config";
import { runStatement } from "@repo/db/testing";
import { Clock, Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  authTest,
  bootstrapVerifiedAdmin,
  clearMailbox,
  clientOf,
  enableTotp,
  mailRecipients,
  mailSubjects,
  receivedLink,
  registerVerified,
  runWith,
  signIn,
  signInAs,
} from "./testing.ts";

import type { BrowserClient } from "./browser-client.ts";

const OLD_EMAIL = "old@example.com";
const NEW_EMAIL = "new@example.com";
const MINUTES_AGO = 11;
const MILLISECONDS_PER_MINUTE = 60_000;

const strongMember = Effect.fn("strongMember")(function* strongMember() {
  yield* registerVerified(OLD_EMAIL);
  const client = yield* signInAs(APPLICATION.user, OLD_EMAIL);
  yield* enableTotp(client);
  yield* clearMailbox;
  return client;
});

const requestChange = (client: BrowserClient, newEmail: string = NEW_EMAIL) =>
  client.json("/change-email", { newEmail });

const confirmChange = Effect.fn("confirmChange")(function* confirmChange(client: BrowserClient) {
  const link = yield* receivedLink(NEW_EMAIL, mailSubjects.emailChangeVerification);
  const token = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
  return yield* client.status(`/verify-email?${new URLSearchParams({ token }).toString()}`);
});

const signInStatuses = Effect.fn("signInStatuses")(function* signInStatuses() {
  const oldAddress = yield* signIn(yield* clientOf(APPLICATION.user), OLD_EMAIL);
  const newAddress = yield* signIn(yield* clientOf(APPLICATION.user), NEW_EMAIL);
  return { newAddress, oldAddress };
});

describe("email change", () => {
  describe("a member signed in with the password only", () => {
    const it = authTest().extend("outcome", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* requestWeakly() {
          yield* registerVerified(OLD_EMAIL);
          const client = yield* signInAs(APPLICATION.user, OLD_EMAIL);
          yield* clearMailbox;
          const denied = yield* requestChange(client);
          return { denied, recipients: yield* mailRecipients };
        }),
      ),
    );

    it("is refused until a strong authentication", ({ outcome }) => {
      expect(outcome.denied).toStrictEqual({
        body: { message: "STRONG_AUTH_REQUIRED" },
        status: httpStatus.forbidden,
      });
    });

    it("sends no mail", ({ outcome }) => {
      expect(outcome.recipients).toStrictEqual([]);
    });
  });

  describe("a member whose strong authentication is stale", () => {
    const it = authTest().extend("denied", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* requestStale() {
          const client = yield* strongMember();
          yield* runStatement(
            "UPDATE session SET authenticated_at = ? WHERE user_id = (SELECT id FROM user WHERE email = ?)",
            (yield* Clock.currentTimeMillis) - MINUTES_AGO * MILLISECONDS_PER_MINUTE,
            OLD_EMAIL,
          );
          return yield* requestChange(client);
        }),
      ),
    );

    it("is refused", ({ denied }) => {
      expect(denied).toStrictEqual({
        body: { message: "STRONG_AUTH_REQUIRED" },
        status: httpStatus.forbidden,
      });
    });
  });

  describe("a member who just verified the authenticator app", () => {
    const it = authTest().extend("outcome", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* requestStrongly() {
          const client = yield* strongMember();
          const requested = yield* requestChange(client);
          const verification = yield* receivedLink(NEW_EMAIL, mailSubjects.emailChangeVerification);
          const notice = yield* receivedLink(OLD_EMAIL, mailSubjects.emailChangeNotice);
          return {
            notice,
            requested,
            signIn: yield* signInStatuses(),
            verification,
          };
        }),
      ),
    );

    it("has the request accepted", ({ outcome }) => {
      expect(outcome.requested).toStrictEqual({ body: { status: true }, status: httpStatus.ok });
    });

    it("sends the confirmation link to the new address", ({ outcome }) => {
      expect(outcome.verification.pathname).toBe("/verify-email-change");
      expect(new URLSearchParams(outcome.verification.hash.slice(1)).get("token")).not.toBe("");
    });

    it("notifies the old address", ({ outcome }) => {
      expect(outcome.notice.pathname).toBe("/settings/security");
    });

    it("still signs in with the old address only", ({ outcome }) => {
      expect(outcome.signIn).toStrictEqual({
        newAddress: httpStatus.unauthorized,
        oldAddress: httpStatus.ok,
      });
    });
  });

  describe("a confirmation link opened without the member's session", () => {
    const it = authTest().extend("outcome", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* confirmAnonymously() {
          const client = yield* strongMember();
          yield* requestChange(client);
          const confirmed = yield* confirmChange(yield* clientOf(APPLICATION.user));
          return { confirmed, signIn: yield* signInStatuses() };
        }),
      ),
    );

    it("is refused", ({ outcome }) => {
      expect(outcome.confirmed).toBe(httpStatus.forbidden);
    });

    it("leaves the old address in place", ({ outcome }) => {
      expect(outcome.signIn).toStrictEqual({
        newAddress: httpStatus.unauthorized,
        oldAddress: httpStatus.ok,
      });
    });
  });

  describe("a confirmation link opened with the member's session", () => {
    const it = authTest().extend("outcome", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* confirm() {
          const client = yield* strongMember();
          yield* requestChange(client);
          const confirmed = yield* confirmChange(client);
          const session = yield* client.verify();
          return { confirmed, email: session.user.email, signIn: yield* signInStatuses() };
        }),
      ),
    );

    it("is accepted", ({ outcome }) => {
      expect(outcome.confirmed).toBe(httpStatus.ok);
    });

    it("moves the session to the new address", ({ outcome }) => {
      expect(outcome.email).toBe(NEW_EMAIL);
    });

    it("signs in with the new address only", ({ outcome }) => {
      expect(outcome.signIn).toStrictEqual({
        newAddress: httpStatus.ok,
        oldAddress: httpStatus.unauthorized,
      });
    });
  });

  describe("a change to an address that is already registered", () => {
    const it = authTest().extend("outcome", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* requestTaken() {
          yield* registerVerified("taken@example.com");
          const client = yield* strongMember();
          const requested = yield* requestChange(client, "taken@example.com");
          return { recipients: yield* mailRecipients, requested };
        }),
      ),
    );

    it("looks accepted", ({ outcome }) => {
      expect(outcome.requested).toStrictEqual({ body: { status: true }, status: httpStatus.ok });
    });

    it("notifies the old address without mailing the taken one", ({ outcome }) => {
      expect(outcome.recipients).toStrictEqual([OLD_EMAIL]);
    });
  });

  describe("an administrator on the admin app", () => {
    const it = authTest().extend("denied", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* requestAsAdmin() {
          yield* bootstrapVerifiedAdmin("admin@example.com");
          const client = yield* signInAs(APPLICATION.admin, "admin@example.com");
          yield* enableTotp(client);
          return yield* client.status("/change-email", { newEmail: NEW_EMAIL });
        }),
      ),
    );

    it("cannot change the address", ({ denied }) => {
      expect(denied).toBe(httpStatus.badRequest);
    });
  });
});
