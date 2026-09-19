import { applications, roles } from "@repo/config";
import { Effect, Option, Schema, SchemaGetter } from "effect";

const maximumIdentifierLength = 256;
const maximumNameLength = 100;
const maximumProfileLength = 2000;
const maximumTokenLength = 4096;
const maximumKeywordLength = 100;
const secondPage = 2;
const defaultPageSize = 50;
const maximumPageSize = 100;

const Role = Schema.Literals(roles);
const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

const ErrorBody = Schema.Struct({ error: Schema.String });

const SessionView = Schema.Struct({
  strong: Schema.Boolean,
  user: Schema.Struct({
    email: Schema.String,
    id: Schema.String,
    name: Schema.String,
    role: Role,
    twoFactorEnabled: Schema.Boolean,
  }),
});

const ProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  profile: Schema.String,
});

const ProfileUpdate = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumNameLength)),
  profile: Schema.String.check(Schema.isMaxLength(maximumProfileLength)),
});

const MemberQuery = Schema.Struct({ id: Identifier });

const MemberView = Schema.Struct({
  id: Schema.String,
  joined: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/u)),
  name: Schema.String,
  profile: Schema.String,
});

const EmailVerificationRequest = Schema.Struct({
  token: Schema.String.check(Schema.isLengthBetween(1, maximumTokenLength)),
});

const EmailVerified = Schema.Struct({ verified: Schema.Literal(true) });

function pageNumber(
  fallback: number,
  minimum: number,
  maximum: number,
): Schema.withDecodingDefaultKey<Schema.NumberFromString> {
  const range = Schema.isBetween({ maximum, minimum });
  const bounded = Schema.NumberFromString.check(Schema.isInt(), range);
  const fallbackText = Effect.succeed(String(fallback));
  return bounded.pipe(Schema.withDecodingDefaultKey(fallbackText));
}

const UserKeyword = Schema.Trim.check(Schema.isLengthBetween(1, maximumKeywordLength));
const BooleanText = Schema.Literals(["true", "false"]).transform([true, false]);

const JsonScalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]);
const ScalarText = JsonScalar.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform<string, string | number | boolean | null>(String),
    encode: SchemaGetter.transform((text: string) => text),
  }),
);

const SearchKeyword = ScalarText.pipe(Schema.decodeTo(UserKeyword));

function laterPage(maximum: number): Schema.Codec<number, number | string> {
  return Schema.Union([Schema.Number, Schema.NumberFromString]).check(
    Schema.isInt(),
    Schema.isBetween({ maximum, minimum: secondPage }),
  );
}

function absentSearchKey(): Effect.Effect<Option.Option<never>> {
  return Effect.succeed(Option.none());
}

const memberPageSize = 24;
const maximumMemberPage = 1_000_000;

const MemberListQuery = Schema.Struct({
  keyword: Schema.optionalKey(UserKeyword),
  page: pageNumber(1, 1, maximumMemberPage),
});

const MemberList = Schema.Struct({
  members: Schema.Array(MemberView),
  pageSize: Schema.Literal(memberPageSize),
  total: Schema.Finite,
});

const UserListQuery = Schema.Struct({
  emailVerified: Schema.optionalKey(BooleanText),
  keyword: Schema.optionalKey(UserKeyword),
  limit: pageNumber(defaultPageSize, 1, maximumPageSize),
  offset: pageNumber(0, 0, Number.MAX_SAFE_INTEGER),
  role: Schema.optionalKey(Role),
});

const UserSummary = Schema.Struct({
  createdAt: Schema.DateFromString,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  role: Role,
  twoFactorEnabled: Schema.Boolean,
});

const UserList = Schema.Struct({ total: Schema.Finite, users: Schema.Array(UserSummary) });

const RoleChange = Schema.Struct({ id: Identifier, role: Role });

const RoleChanged = Schema.Struct({ id: Schema.String, role: Role });

const UserDeletion = Schema.Struct({ id: Identifier });

const UserDeleted = Schema.Struct({ id: Schema.String });

const HealthView = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String,
  service: Schema.Literals(applications),
});

const maximumContactNameLength = 100;
const maximumContactMessageLength = 4000;

const ContactSubmission = Schema.Struct({
  email: Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u)),
  message: Schema.Trim.check(Schema.isLengthBetween(1, maximumContactMessageLength)),
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumContactNameLength)),
});

const ContactAccepted = Schema.Struct({ ok: Schema.Literal(true) });

export {
  BooleanText,
  ContactAccepted,
  ContactSubmission,
  EmailVerificationRequest,
  EmailVerified,
  ErrorBody,
  HealthView,
  MemberList,
  MemberListQuery,
  MemberQuery,
  MemberView,
  ProfileUpdate,
  ProfileView,
  Role,
  RoleChange,
  RoleChanged,
  SearchKeyword,
  SessionView,
  UserDeleted,
  UserDeletion,
  UserKeyword,
  UserList,
  UserListQuery,
  absentSearchKey,
  laterPage,
  maximumContactMessageLength,
  maximumContactNameLength,
  maximumKeywordLength,
  maximumMemberPage,
  memberPageSize,
  maximumNameLength,
  maximumProfileLength,
};
