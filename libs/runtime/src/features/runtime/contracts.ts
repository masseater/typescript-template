import { applications } from "@repo/config";
import { accountPermissions, roles } from "@repo/config/identity";
import {
  Identifier,
  SearchKeyword,
  UserKeyword,
  laterPage,
  maximumIdentifierLength,
  maximumKeywordLength,
  pageNumber,
} from "@repo/config/paging";
import { Schema } from "effect";

const maximumTokenLength = 4096;

const maximumNameLength = 100;
const minimumPasswordLength = 12;
const maximumPasswordLength = 128;

const Role = Schema.Literals(roles);
const AccountPermission = Schema.Literals(accountPermissions);

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

const IdentifierQuery = Schema.Struct({ id: Identifier });
const CreatedResource = Schema.Struct({ id: Schema.String });
const Acknowledged = Schema.Struct({ ok: Schema.Literal(true) });
const Tally = Schema.Struct({ count: Schema.Finite });
const Redirect = Schema.Struct({ url: Schema.String });
const InvitationIssued = Schema.Struct({ email: Schema.String, expiresAt: Schema.DateFromString });
const InquiryMessage = Schema.Struct({
  authorId: Schema.String,
  authorKind: Role,
  body: Schema.String,
  createdAt: Schema.DateFromString,
  id: Schema.String,
});

type Decodable = Schema.Top & { readonly DecodingServices: never };

export {
  AccountPermission,
  Acknowledged,
  CreatedResource,
  EmailVerificationRequest,
  EmailVerified,
  ErrorBody,
  HealthView,
  Identifier,
  IdentifierQuery,
  InquiryMessage,
  InvitationIssued,
  InviteAcceptance,
  InviteAccepted,
  InvitePreview,
  InvitePreviewQuery,
  Redirect,
  Role,
  SearchKeyword,
  SessionView,
  Tally,
  UserKeyword,
  laterPage,
  maximumIdentifierLength,
  maximumKeywordLength,
  maximumNameLength,
  maximumPasswordLength,
  minimumPasswordLength,
  pageNumber,
};
export type { Decodable };
