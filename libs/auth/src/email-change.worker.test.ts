import { APPLICATION } from "@repo/config";
import { runStatement } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { Clock, Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { requestEmailChange } from "./email-change.ts";
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

const strongMember = Effect.fn("strongMember")(function* strongMemberProgram() {
  yield* registerVerified(OLD_EMAIL);
  const client = yield* signInAs(APPLICATION.user, OLD_EMAIL);
  yield* enableTotp(client);
  yield* clearMailbox;
  return client;
});

const confirmEmailChange = Effect.fn("confirmEmailChange")(function* confirmEmailChangeProgram(
  client: BrowserClient,
) {
  const link = yield* receivedLink(NEW_EMAIL, mailSubjects.emailChangeVerification);
  const token = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
  return yield* client.status(`/verify-email?${new URLSearchParams({ token }).toString()}`);
});

const signInStatuses = Effect.fn("signInStatuses")(function* signInStatusesProgram() {
  const oldAddress = yield* signIn(yield* clientOf(APPLICATION.user), OLD_EMAIL);
  const newAddress = yield* signIn(yield* clientOf(APPLICATION.user), NEW_EMAIL);
  return { newAddress, oldAddress };
});

describe("email change", () => {
  describe("a member signed in with the password only", () => {
    const it = authTest
      .extend("denied", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* requestWeakly() {
            yield* registerVerified(OLD_EMAIL);
            const client = yield* signInAs(APPLICATION.user, OLD_EMAIL);
            yield* clearMailbox;
            return yield* requestEmailChange(client, NEW_EMAIL);
          }),
        ),
      )
      .extend("recipients", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* requestWeaklyMail() {
            yield* registerVerified(OLD_EMAIL);
            const client = yield* signInAs(APPLICATION.user, OLD_EMAIL);
            yield* clearMailbox;
            yield* requestEmailChange(client, NEW_EMAIL);
            return yield* mailRecipients;
          }),
        ),
      );

    it("is refused until a strong authentication", ({ denied }) => {
      expect(denied).toStrictEqual({
        body: { message: "STRONG_AUTH_REQUIRED" },
        status: httpStatus.forbidden,
      });
    });

    it("sends no mail", ({ recipients }) => {
      expect(recipients).toStrictEqual([]);
    });
  });

  describe("a member whose strong authentication is stale", () => {
    const it = authTest.extend("denied", ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* requestStale() {
          const client = yield* strongMember();
          yield* runStatement(
            "UPDATE session SET authenticated_at = ? WHERE user_id = (SELECT id FROM user WHERE email = ?)",
            (yield* Clock.currentTimeMillis) - MINUTES_AGO * MILLISECONDS_PER_MINUTE,
            OLD_EMAIL,
          );
          return yield* requestEmailChange(client, NEW_EMAIL);
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
    const it = authTest
      .extend("requested", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* requestStrongly() {
            const client = yield* strongMember();
            return yield* requestEmailChange(client, NEW_EMAIL);
          }),
        ),
      )
      .extend("verificationPath", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* verificationMail() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            return (yield* receivedLink(NEW_EMAIL, mailSubjects.emailChangeVerification)).pathname;
          }),
        ),
      )
      .extend("verificationTokenPresent", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* verificationToken() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            const link = yield* receivedLink(NEW_EMAIL, mailSubjects.emailChangeVerification);
            return (
              new URLSearchParams(link.hash.slice(1)).get("token") !== null &&
              new URLSearchParams(link.hash.slice(1)).get("token") !== ""
            );
          }),
        ),
      )
      .extend("noticePath", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* noticeMail() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            return (yield* receivedLink(OLD_EMAIL, mailSubjects.emailChangeNotice)).pathname;
          }),
        ),
      )
      .extend("signIn", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInAfterRequest() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            return yield* signInStatuses();
          }),
        ),
      );

    it("has the request accepted", ({ requested }) => {
      expect(requested).toStrictEqual({ body: { status: true }, status: httpStatus.ok });
    });

    it("sends the confirmation link to the new address", ({ verificationPath }) => {
      expect(verificationPath).toStrictEqual("/verify-email-change");
    });

    it("includes a confirmation token", ({ verificationTokenPresent }) => {
      expect(verificationTokenPresent).toStrictEqual(true);
    });

    it("notifies the old address", ({ noticePath }) => {
      expect(noticePath).toStrictEqual("/settings/security");
    });

    it("still signs in with the old address only", ({ signIn }) => {
      expect(signIn).toStrictEqual({
        newAddress: httpStatus.unauthorized,
        oldAddress: httpStatus.ok,
      });
    });
  });

  describe("a confirmation link opened without the member's session", () => {
    const it = authTest
      .extend("confirmed", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* confirmAnonymously() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            return yield* confirmEmailChange(yield* clientOf(APPLICATION.user));
          }),
        ),
      )
      .extend("signIn", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInAfterAnonymousConfirm() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            yield* confirmEmailChange(yield* clientOf(APPLICATION.user));
            return yield* signInStatuses();
          }),
        ),
      );

    it("is refused", ({ confirmed }) => {
      expect(confirmed).toStrictEqual(httpStatus.forbidden);
    });

    it("leaves the old address in place", ({ signIn }) => {
      expect(signIn).toStrictEqual({
        newAddress: httpStatus.unauthorized,
        oldAddress: httpStatus.ok,
      });
    });
  });

  describe("a confirmation link opened with the member's session", () => {
    const it = authTest
      .extend("confirmed", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* confirm() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            return yield* confirmEmailChange(client);
          }),
        ),
      )
      .extend("email", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* sessionEmail() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            yield* confirmEmailChange(client);
            return (yield* client.verify()).user.email;
          }),
        ),
      )
      .extend("signIn", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* signInAfterConfirm() {
            const client = yield* strongMember();
            yield* requestEmailChange(client, NEW_EMAIL);
            yield* confirmEmailChange(client);
            return yield* signInStatuses();
          }),
        ),
      );

    it("is accepted", ({ confirmed }) => {
      expect(confirmed).toStrictEqual(httpStatus.ok);
    });

    it("moves the session to the new address", ({ email }) => {
      expect(email).toStrictEqual(NEW_EMAIL);
    });

    it("signs in with the new address only", ({ signIn }) => {
      expect(signIn).toStrictEqual({
        newAddress: httpStatus.ok,
        oldAddress: httpStatus.unauthorized,
      });
    });
  });

  describe("a change to an address that is already registered", () => {
    const it = authTest
      .extend("requested", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* requestTaken() {
            yield* registerVerified("taken@example.com");
            const client = yield* strongMember();
            return yield* requestEmailChange(client, "taken@example.com");
          }),
        ),
      )
      .extend("recipients", ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* takenRecipients() {
            yield* registerVerified("taken@example.com");
            const client = yield* strongMember();
            yield* requestEmailChange(client, "taken@example.com");
            return yield* mailRecipients;
          }),
        ),
      );

    it("looks accepted", ({ requested }) => {
      expect(requested).toStrictEqual({ body: { status: true }, status: httpStatus.ok });
    });

    it("notifies the old address without mailing the taken one", ({ recipients }) => {
      expect(recipients).toStrictEqual([OLD_EMAIL]);
    });
  });

  describe("an administrator on the admin app", () => {
    const it = authTest.extend("denied", ({ auth }) =>
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
      expect(denied).toStrictEqual(httpStatus.badRequest);
    });
  });
});
