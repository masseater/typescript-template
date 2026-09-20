import { ADMIN_PERMISSION, APPLICATION, STAFF_PERMISSION } from "@repo/config";
import { inviteAdmin } from "@repo/db/admin";
import { inviteStaff } from "@repo/db/staff";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import { Auth } from "./auth.ts";
import { mailSubjects } from "./email.ts";
import { acceptInvitation, mailInvite, previewInvitation } from "./invite.ts";
import {
  AuthApps,
  PASSWORD,
  authTest,
  bootstrapVerifiedAdmin,
  clientOf,
  enableTotp,
  origins,
  receivedLink,
  runWith,
  signIn,
  signInAs,
  wikiStaff,
} from "./testing.ts";

const tokenOf = (link: URL): string => decodeURIComponent(link.pathname.split("/").at(-1) ?? "");

describe("an administrator invite", () => {
  const it = authTest().extend("outcome", async ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* inviteAndAccept() {
        yield* bootstrapVerifiedAdmin("owner@example.com");
        const owner = yield* signInAs(APPLICATION.admin, "owner@example.com");
        yield* enableTotp(owner);
        const authority = yield* owner.verify();
        const admin = (yield* AuthApps)[APPLICATION.admin];
        const invited = yield* inviteAdmin({
          email: "invited@example.com",
          permission: ADMIN_PERMISSION.operator,
          sessionId: authority.session.id,
        });
        yield* mailInvite(invited).pipe(Effect.provideService(Auth, admin));
        const link = yield* receivedLink("invited@example.com", mailSubjects.invite);
        const token = tokenOf(link);
        const preview = yield* previewInvitation(token).pipe(Effect.provideService(Auth, admin));
        const accepted = yield* acceptInvitation({
          name: "Invited",
          password: PASSWORD,
          token,
        }).pipe(Effect.provideService(Auth, admin));
        const reused = yield* Effect.flip(
          acceptInvitation({ name: "Again", password: PASSWORD, token }).pipe(
            Effect.provideService(Auth, admin),
          ),
        );
        const client = yield* signInAs(APPLICATION.admin, "invited@example.com");
        const session = yield* client.verify(true);
        const memberSignIn = yield* signIn(
          yield* clientOf(APPLICATION.user),
          "invited@example.com",
        );
        return {
          accepted: { permission: accepted.permission, role: accepted.role },
          link: {
            origin: link.origin === origins[APPLICATION.admin],
            path: link.pathname.replace(token, "{token}"),
          },
          memberSignIn,
          preview: preview === undefined ? undefined : preview.email,
          reused: reused._tag,
          session: { permission: session.user.permission, role: session.user.role },
        };
      }),
    ),
  );

  it("mails a link that creates one administrator with the invited level", ({ outcome }) => {
    expect(outcome).toStrictEqual({
      accepted: { permission: ADMIN_PERMISSION.operator, role: "admin" },
      link: { origin: true, path: "/invite/{token}" },
      memberSignIn: 403,
      preview: "invited@example.com",
      reused: "InviteRejected",
      session: { permission: ADMIN_PERMISSION.operator, role: "admin" },
    });
  });
});

describe("a staff invite", () => {
  const it = authTest().extend("outcome", async ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* inviteStaffMember() {
        const editor = yield* wikiStaff("editor@example.com");
        const authority = yield* editor.verify();
        const wiki = (yield* AuthApps)[APPLICATION.wiki];
        const invited = yield* inviteStaff({
          email: "reader@example.com",
          permission: STAFF_PERMISSION.viewer,
          sessionId: authority.session.id,
        });
        yield* mailInvite(invited).pipe(Effect.provideService(Auth, wiki));
        const link = yield* receivedLink("reader@example.com", mailSubjects.invite);
        const accepted = yield* acceptInvitation({
          name: "Reader",
          password: PASSWORD,
          token: tokenOf(link),
        }).pipe(Effect.provideService(Auth, wiki));
        const client = yield* signInAs(APPLICATION.wiki, "reader@example.com");
        const session = yield* client.verify(true);
        return {
          accepted: { permission: accepted.permission, role: accepted.role },
          linkOrigin: link.origin === origins[APPLICATION.wiki],
          session: { permission: session.user.permission, role: session.user.role },
        };
      }),
    ),
  );

  it("creates a staff account that signs in to the internal dashboard", ({ outcome }) => {
    expect(outcome).toStrictEqual({
      accepted: { permission: STAFF_PERMISSION.viewer, role: "staff" },
      linkOrigin: true,
      session: { permission: STAFF_PERMISSION.viewer, role: "staff" },
    });
  });
});
