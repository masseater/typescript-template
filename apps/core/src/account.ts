import { acceptInvitation, previewInvitation, verifyEmailToken } from "@repo/auth";
import {
  EmailVerificationFailed,
  type EmailVerified,
  type InviteAcceptance,
  type InviteAccepted,
  type InvitePreview,
} from "@repo/core-api";
import { InviteRejected } from "@repo/db";
import { Effect } from "effect";

import type { Auth } from "@repo/auth";
import type { Database } from "@repo/db";
import type * as HttpHeaders from "effect/unstable/http/Headers";

const webHeaders = (headers: HttpHeaders.Headers): Headers => new Headers(headers);

const previewInvite = (
  token: string,
): Effect.Effect<typeof InvitePreview.Type, InviteRejected, Auth | Database> =>
  Effect.gen(function* previewInviteProgram() {
    const preview = yield* previewInvitation(token);
    if (preview === undefined) {
      return yield* new InviteRejected({ reason: "missing" });
    }
    return { email: preview.email, permission: preview.permission };
  }).pipe(Effect.catchTag("DatabaseFailure", (failure) => Effect.die(failure)));

const acceptInvite = (
  acceptance: typeof InviteAcceptance.Type,
): Effect.Effect<typeof InviteAccepted.Type, InviteRejected, Auth | Database> =>
  Effect.gen(function* acceptInviteProgram() {
    const created = yield* acceptInvitation(acceptance);
    return { accepted: true as const, email: created.email };
  }).pipe(Effect.catchTag("DatabaseFailure", (failure) => Effect.die(failure)));

const verifyEmail = (
  token: string,
  headers: HttpHeaders.Headers,
): Effect.Effect<typeof EmailVerified.Type, EmailVerificationFailed, Auth> =>
  verifyEmailToken(token, webHeaders(headers)).pipe(
    Effect.catchTags({
      AuthFailure: (failure) => Effect.die(failure),
      EmailVerificationFailed: (failure) =>
        Effect.fail(new EmailVerificationFailed({ rateLimited: failure.rateLimited })),
    }),
  );

export { acceptInvite, previewInvite, verifyEmail };
