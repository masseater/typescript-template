import { Effect, Schema } from "effect";
import { applications, roles } from "@template/config";

const maximumIdentifierLength = 256;
const maximumNameLength = 100;
const maximumProfileLength = 2000;
const maximumTokenLength = 4096;
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

const UserListQuery = Schema.Struct({
  limit: pageNumber(defaultPageSize, 1, maximumPageSize),
  offset: pageNumber(0, 0, Number.MAX_SAFE_INTEGER),
});

const UserSummary = Schema.Struct({
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  role: Role,
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

export {
  EmailVerificationRequest,
  EmailVerified,
  ErrorBody,
  HealthView,
  MemberQuery,
  MemberView,
  ProfileUpdate,
  ProfileView,
  RoleChange,
  RoleChanged,
  SessionView,
  UserDeleted,
  UserDeletion,
  UserList,
  UserListQuery,
};
