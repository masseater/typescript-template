import { accountPermissions, roles } from "@repo/config";
import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";

class SessionRequired extends Schema.TaggedError<SessionRequired>()("SessionRequired", {}) {}

class SessionInvalid extends Schema.TaggedError<SessionInvalid>()("SessionInvalid", {}) {}

const SessionFailure = Schema.Union([SessionRequired, SessionInvalid]);

const SessionUser = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  permission: Schema.NullOr(Schema.Literals(accountPermissions)),
  role: Schema.Literals(roles),
  twoFactorEnabled: Schema.Boolean,
});

const SessionIdentityView = Schema.Struct({
  session: Schema.Struct({ id: Schema.String }),
  strong: Schema.Boolean,
  user: SessionUser,
});

class SessionIdentity extends Context.Service<SessionIdentity, typeof SessionIdentityView.Type>()(
  "@repo/core-api/SessionIdentity",
) {}

class SessionIdentityMiddleware extends RpcMiddleware.Service<
  SessionIdentityMiddleware,
  { provides: SessionIdentity }
>()("@repo/core-api/SessionIdentityMiddleware", {
  error: SessionFailure,
}) {}

export {
  SessionFailure,
  SessionIdentity,
  SessionIdentityMiddleware,
  SessionIdentityView,
  SessionInvalid,
  SessionRequired,
  SessionUser,
};
