import { applications } from "@repo/config";
import { accountPermissions, roles } from "@repo/config/identity";
import { Effect, Schema, SchemaGetter } from "effect";

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

const IdentifierQuery = Schema.Struct({ id: Identifier });
const CreatedResource = Schema.Struct({ id: Schema.String });

const pageNumber = ({
  fallback,
  maximum,
  minimum,
}: {
  readonly fallback: number;
  readonly maximum: number;
  readonly minimum: number;
}): Schema.withDecodingDefaultKey<Schema.FiniteFromString> => {
  const range = Schema.isBetween({ maximum, minimum });
  const bounded = Schema.FiniteFromString.check(Schema.isInt(), range);
  const fallbackText = Effect.succeed(String(fallback));
  return bounded.pipe(Schema.withDecodingDefaultKey(fallbackText));
};

const secondPage = 2;
const laterPage = (maximum: number): Schema.Codec<number, number | string> =>
  Schema.Union([Schema.Finite, Schema.FiniteFromString]).check(
    Schema.isInt(),
    Schema.isBetween({ maximum, minimum: secondPage }),
  );

const maximumKeywordLength = 100;
const UserKeyword = Schema.Trim.check(Schema.isLengthBetween(1, maximumKeywordLength));
const JsonScalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]);
const ScalarText = JsonScalar.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform<string, string | number | boolean | null>(String),
    encode: SchemaGetter.transform((scalarText: string) => scalarText),
  }),
);
const SearchKeyword = ScalarText.pipe(Schema.decodeTo(UserKeyword));

type Decodable = Schema.Top & { readonly DecodingServices: never };

export {
  AccountPermission,
  CreatedResource,
  EmailVerificationRequest,
  EmailVerified,
  ErrorBody,
  HealthView,
  Identifier,
  IdentifierQuery,
  InviteAcceptance,
  InviteAccepted,
  InvitePreview,
  InvitePreviewQuery,
  Role,
  SearchKeyword,
  SessionView,
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
