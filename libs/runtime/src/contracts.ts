import { applications } from "@repo/config";
import { accountPermissions, roles } from "@repo/config/identity";
import { Schema } from "effect";

const maximumTokenLength = 4096;
const maximumIdentifierLength = 256;

const maximumNameLength = 100;
const minimumPasswordLength = 12;
const maximumPasswordLength = 128;

const Role = Schema.Literals(roles);
const AccountPermission = Schema.Literals(accountPermissions);

const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

const ErrorBody = Schema.Struct({ error: Schema.String });

const SessionView = Schema.Struct({
  strong: Schema.Boolean,
  user: Schema.Struct({
    email: Schema.String,
    id: Schema.String,
    name: Schema.String,
    permission: Schema.NullOr(AccountPermission),
    role: Role,
    twoFactorEnabled: Schema.Boolean,
  }),
});

const InviteToken = Schema.String.check(Schema.isLengthBetween(1, maximumTokenLength));

const InvitePreviewQuery = Schema.Struct({ token: InviteToken });

const InvitePreview = Schema.Struct({ email: Schema.String, permission: AccountPermission });

const InviteAcceptance = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumNameLength)),
  password: Schema.String.check(
    Schema.isLengthBetween(minimumPasswordLength, maximumPasswordLength),
  ),
  token: InviteToken,
});

const InviteAccepted = Schema.Struct({ accepted: Schema.Literal(true), email: Schema.String });

const EmailVerificationRequest = Schema.Struct({
  token: Schema.String.check(Schema.isLengthBetween(1, maximumTokenLength)),
});

const EmailVerified = Schema.Struct({ verified: Schema.Literal(true) });

const HealthView = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String,
  service: Schema.Literals(applications),
});

export {
  AccountPermission,
  EmailVerificationRequest,
  EmailVerified,
  ErrorBody,
  HealthView,
  Identifier,
  InviteAcceptance,
  InviteAccepted,
  InvitePreview,
  InvitePreviewQuery,
  Role,
  SessionView,
  maximumNameLength,
  maximumPasswordLength,
  minimumPasswordLength,
};
