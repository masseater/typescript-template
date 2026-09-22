import { accountPermissions } from "@repo/config";
import { InviteRejected } from "@repo/db";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

class EmailVerificationFailed extends Schema.TaggedError<EmailVerificationFailed>()(
  "EmailVerificationFailed",
  { rateLimited: Schema.Boolean },
) {}

const maximumTokenLength = 4096;
const maximumNameLength = 100;
const minimumPasswordLength = 12;
const maximumPasswordLength = 128;

const InviteToken = Schema.String.check(Schema.isLengthBetween(1, maximumTokenLength));

const InvitePreview = Schema.Struct({
  email: Schema.String,
  permission: Schema.Literals(accountPermissions),
});

const InviteAcceptance = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumNameLength)),
  password: Schema.String.check(
    Schema.isLengthBetween(minimumPasswordLength, maximumPasswordLength),
  ),
  token: InviteToken,
});

const InviteAccepted = Schema.Struct({
  accepted: Schema.Literal(true),
  email: Schema.String,
});

const EmailVerified = Schema.Struct({ verified: Schema.Literal(true) });

const previewInvite = Rpc.make("previewInvite", {
  error: InviteRejected,
  payload: { token: InviteToken },
  success: InvitePreview,
});

const acceptInvite = Rpc.make("acceptInvite", {
  error: InviteRejected,
  payload: InviteAcceptance,
  success: InviteAccepted,
});

const verifyEmail = Rpc.make("verifyEmail", {
  error: EmailVerificationFailed,
  payload: { token: InviteToken },
  success: EmailVerified,
});

export class AccountRpcs extends RpcGroup.make(verifyEmail) {}

export class InviteRpcs extends RpcGroup.make(previewInvite, acceptInvite) {}

export {
  EmailVerificationFailed,
  EmailVerified,
  InviteAcceptance,
  InviteAccepted,
  InvitePreview,
  InviteRejected,
  acceptInvite,
  previewInvite,
  verifyEmail,
};
