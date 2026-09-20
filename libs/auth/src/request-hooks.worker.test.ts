import { APPLICATION } from "@repo/config";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  AuthApps,
  PASSWORD,
  authTest,
  bootstrapVerifiedAdmin,
  clientOf,
  enableTotp,
  pendingSecondFactor,
  registerVerified,
  requireStatus,
  runWith,
  sessionBeforeEnrollment,
  signInAgainAfterTotp,
  signInAs,
  startAuthorization,
} from "./testing.ts";

describe("request hooks", () => {
  describe.for([APPLICATION.user, APPLICATION.admin] as const)(
    "an administrator session on %s opened before TOTP enrollment",
    (audience) => {
      const it = authTest()
        .extend("scenario", async ({ auth }) =>
          runWith(auth, () =>
            Effect.gen(function* openWeakSession() {
              yield* bootstrapVerifiedAdmin("admin@example.com");
              return yield* sessionBeforeEnrollment({
                audience,
                email: "admin@example.com",
                enrollOn: APPLICATION.admin,
              });
            }),
          ),
        )
        .extend("denied", async ({ auth, scenario }) =>
          runWith(auth, () =>
            scenario.old.json("/two-factor/get-totp-uri", { password: PASSWORD }),
          ),
        )
        .extend("retrieved", async ({ auth, scenario }) =>
          runWith(auth, () =>
            Effect.gen(function* strengthen() {
              yield* requireStatus(200, {
                client: scenario.old,
                endpoint: "/two-factor/verify-totp",
                jsonFields: { code: scenario.enrollment.authenticator.generate() },
              });
              return yield* scenario.old.json("/two-factor/get-totp-uri", { password: PASSWORD });
            }),
          ),
        );

      it("cannot read the TOTP secret", ({ denied }) => {
        expect(denied).toStrictEqual({
          body: { message: "ADMIN_MFA_REQUIRED" },
          status: 403,
        });
      });

      it("reads the enrolled TOTP secret once strengthened", ({ retrieved, scenario }) => {
        expect(retrieved).toStrictEqual({
          body: { totpURI: scenario.enrollment.totpURI },
          status: 200,
        });
      });
    },
  );

  describe.for([APPLICATION.user, APPLICATION.admin] as const)(
    "an administrator signed in to %s with a recovery code",
    (audience) => {
      const it = authTest().extend("denied", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* recover() {
            yield* bootstrapVerifiedAdmin("admin@example.com");
            const { backupCodes } = yield* enableTotp(
              yield* signInAs(APPLICATION.admin, "admin@example.com"),
            );
            const client = yield* pendingSecondFactor(audience, "admin@example.com");
            yield* requireStatus(200, {
              client,
              endpoint: "/two-factor/verify-backup-code",
              jsonFields: { code: backupCodes[0] },
            });
            return yield* client.json("/two-factor/get-totp-uri", { password: PASSWORD });
          }),
        ),
      );

      it("cannot read the TOTP secret", ({ denied }) => {
        expect(denied).toStrictEqual({
          body: { message: "ADMIN_MFA_REQUIRED" },
          status: 403,
        });
      });
    },
  );

  describe("a member with TOTP enrolled on another session", () => {
    const it = authTest()
      .extend("scenario", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* openOldSession() {
            yield* registerVerified("reader@example.com");
            return yield* sessionBeforeEnrollment({
              audience: APPLICATION.user,
              email: "reader@example.com",
              enrollOn: APPLICATION.user,
            });
          }),
        ),
      )
      .extend("retrieved", async ({ auth, scenario }) =>
        runWith(auth, () => scenario.old.json("/two-factor/get-totp-uri", { password: PASSWORD })),
      );

    it("reads the TOTP secret with the password", ({ retrieved, scenario }) => {
      expect(retrieved).toStrictEqual({
        body: { totpURI: scenario.enrollment.totpURI },
        status: 200,
      });
    });
  });

  describe("an administrator session left weak after TOTP enrollment elsewhere", () => {
    const it = authTest()
      .extend("old", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* enrollBeside() {
            yield* bootstrapVerifiedAdmin("admin@example.com");
            const { old } = yield* sessionBeforeEnrollment({
              audience: APPLICATION.admin,
              email: "admin@example.com",
              enrollOn: APPLICATION.admin,
            });
            return old;
          }),
        ),
      )
      .extend("passkeyOptions", async ({ auth, old }) =>
        runWith(auth, () => old.json("/passkey/generate-register-options")),
      )
      .extend("wrongCode", async ({ auth, old }) =>
        runWith(auth, () => old.status("/two-factor/verify-totp", { code: "x" })),
      );

    it("cannot enroll another factor", ({ passkeyOptions }) => {
      expect(passkeyOptions).toStrictEqual({
        body: { message: "EXISTING_FACTOR_REQUIRED" },
        status: 403,
      });
    });

    it("rejects a wrong TOTP code", ({ wrongCode }) => {
      expect(wrongCode).toBe(401);
    });
  });

  describe("a pending TOTP challenge replayed against the admin app", () => {
    const it = authTest().extend("transferred", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* transfer() {
          yield* bootstrapVerifiedAdmin("admin@example.com");
          const pending = yield* signInAgainAfterTotp({
            audience: APPLICATION.user,
            email: "admin@example.com",
          });
          const { admin } = yield* AuthApps;
          return yield* pending.client
            .transferTo(admin)
            .json("/two-factor/verify-totp", { code: pending.authenticator.generate() });
        }),
      ),
    );

    it("is refused for the wrong audience", ({ transferred }) => {
      expect(transferred).toStrictEqual({
        body: { message: "CHALLENGE_AUDIENCE_INVALID" },
        status: 403,
      });
    });
  });

  describe("a weak wiki administrator session continuing an OAuth authorization", () => {
    const it = authTest().extend("continued", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* continueWeakly() {
          const flow = yield* startAuthorization();
          yield* bootstrapVerifiedAdmin("owner@example.com");
          const weak = yield* signInAs(APPLICATION.wiki, "owner@example.com");
          return yield* weak.json("/oauth2/continue", {
            oauth_query: flow.oauthQuery,
            postLogin: true,
          });
        }),
      ),
    );

    it("is refused until the second factor", ({ continued }) => {
      expect(continued).toStrictEqual({
        body: { message: "ADMIN_MFA_REQUIRED" },
        status: 403,
      });
    });
  });

  describe("an OAuth query smuggled into a wiki sign-in", () => {
    const it = authTest().extend("smuggled", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* smuggle() {
          const flow = yield* startAuthorization();
          yield* bootstrapVerifiedAdmin("owner@example.com");
          const client = yield* clientOf(APPLICATION.wiki);
          return yield* client.json("/sign-in/email", {
            email: "owner@example.com",
            oauth_query: flow.oauthQuery,
            password: PASSWORD,
          });
        }),
      ),
    );

    it("is refused", ({ smuggled }) => {
      expect(smuggled).toStrictEqual({
        body: { message: "OAUTH_QUERY_NOT_ACCEPTED" },
        status: 403,
      });
    });
  });
});
