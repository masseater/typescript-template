import { verifySession, verifySessionOrApiKey } from "@repo/auth";
import { APPLICATION, type Application } from "@repo/config";
import {
  SessionIdentity,
  SessionIdentityMiddleware,
  SessionInvalid,
  SessionRequired,
  type SessionIdentityView,
} from "@repo/core-api";
import { Effect, Layer } from "effect";

import { authLayer } from "./auth-layer.ts";

import type { Auth } from "@repo/auth";
import type { Database } from "@repo/db";
import type * as HttpHeaders from "effect/unstable/http/Headers";
import type { CoreBindings } from "./bindings.ts";

const webHeaders = (headers: HttpHeaders.Headers): Headers => new Headers(headers);

const asSessionIdentity = (identity: {
  readonly session: { readonly id: string };
  readonly strong: boolean;
  readonly user: {
    readonly email: string;
    readonly id: string;
    readonly name: string;
    readonly permission?: string | null;
    readonly role: string;
    readonly twoFactorEnabled: boolean;
  };
}): typeof SessionIdentityView.Type => ({
  session: identity.session,
  strong: identity.strong,
  user: {
    email: identity.user.email,
    id: identity.user.id,
    name: identity.user.name,
    permission: (identity.user.permission ??
      null) as typeof SessionIdentityView.Type.user.permission,
    role: identity.user.role as typeof SessionIdentityView.Type.user.role,
    twoFactorEnabled: identity.user.twoFactorEnabled,
  },
});

const sessionIdentity = (
  headers: HttpHeaders.Headers,
  audience: Application,
): Effect.Effect<
  typeof SessionIdentityView.Type,
  SessionRequired | SessionInvalid,
  Auth | Database
> => {
  const verify =
    audience === APPLICATION.user
      ? verifySessionOrApiKey(webHeaders(headers), true)
      : verifySession(webHeaders(headers), true);
  return verify.pipe(
    Effect.map(asSessionIdentity),
    Effect.catchTags({
      AdminMfaRequired: (failure) => Effect.die(failure),
      AdminRequired: (failure) => Effect.die(failure),
      DatabaseFailure: (failure) => Effect.die(failure),
      SessionInvalid: () => Effect.fail(new SessionInvalid()),
      SessionRequired: () => Effect.fail(new SessionRequired()),
    }),
  );
};

const sessionIdentityMiddleware = (
  bindings: CoreBindings,
  audience: Application,
): Layer.Layer<SessionIdentityMiddleware> =>
  Layer.succeed(SessionIdentityMiddleware, (handler, { headers }) =>
    sessionIdentity(headers, audience).pipe(
      Effect.flatMap((identity) => Effect.provideService(handler, SessionIdentity, identity)),
      Effect.provide(authLayer(bindings, audience)),
    ),
  );

export { sessionIdentityMiddleware };
