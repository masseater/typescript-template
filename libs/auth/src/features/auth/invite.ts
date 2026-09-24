import { acceptInvite, previewInvite } from "@repo/db";
import { hashPassword } from "better-auth/crypto";
import { Effect } from "effect";

import { Auth } from "./auth.ts";
import { sendInviteEmail } from "./email.ts";

const inviteLink = (origin: string, token: string): string =>
  new URL(`/invite/${encodeURIComponent(token)}`, origin).href;

const mailInvite = Effect.fn("mailInvite")(function* mailInvite(invitation: {
  readonly email: string;
  readonly token: string;
}) {
  const { mail } = yield* Auth;
  yield* sendInviteEmail(mail, {
    email: invitation.email,
    url: inviteLink(mail.APP_ORIGIN, invitation.token),
  });
});

const previewInvitation = Effect.fn("previewInvitation")(function* previewInvitation(
  token: string,
) {
  const { audience } = yield* Auth;
  return yield* previewInvite(token, audience);
});

const acceptInvitation = Effect.fn("acceptInvitation")(function* acceptInvitation(accepted: {
  readonly name: string;
  readonly password: string;
  readonly token: string;
}) {
  const { audience } = yield* Auth;
  const passwordHash = yield* Effect.promise(() => hashPassword(accepted.password));
  return yield* acceptInvite({
    audience,
    name: accepted.name,
    passwordHash,
    rawToken: accepted.token,
  });
});

export { acceptInvitation, mailInvite, previewInvitation };
