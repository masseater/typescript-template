import { Effect, Schema } from "effect";

const Role = Schema.Literals(["user", "admin"]);
const Identifier = Schema.String.check(Schema.isLengthBetween(1, 256));

export const ErrorBody = Schema.Struct({ error: Schema.String });

export const SessionView = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    email: Schema.String,
    role: Role,
    twoFactorEnabled: Schema.Boolean,
  }),
  strong: Schema.Boolean,
});

export const ProfileView = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  profile: Schema.String,
});

export const ProfileUpdate = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, 100)),
  profile: Schema.String.check(Schema.isMaxLength(2000)),
});

export const EmailVerificationRequest = Schema.Struct({
  token: Schema.String.check(Schema.isLengthBetween(1, 4096)),
});

export const EmailVerified = Schema.Struct({ verified: Schema.Literal(true) });

const pageNumber = (fallback: number, minimum: number, maximum: number) =>
  Schema.NumberFromString.pipe(
    Schema.check(Schema.isInt(), Schema.isBetween({ minimum, maximum })),
    Schema.withDecodingDefaultKey(Effect.succeed(String(fallback))),
  );

export const UserListQuery = Schema.Struct({
  limit: pageNumber(50, 1, 100),
  offset: pageNumber(0, 0, Number.MAX_SAFE_INTEGER),
});

export const UserList = Schema.Struct({
  users: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      email: Schema.String,
      role: Role,
      emailVerified: Schema.Boolean,
    }),
  ),
  total: Schema.Finite,
});

export const RoleChange = Schema.Struct({ id: Identifier, role: Role });

export const RoleChanged = Schema.Struct({ id: Schema.String, role: Role });

export const UserDeletion = Schema.Struct({ id: Identifier });

export const UserDeleted = Schema.Struct({ id: Schema.String });
