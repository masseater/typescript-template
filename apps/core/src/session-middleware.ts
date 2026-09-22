import { verifySession } from "@repo/auth";
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
import type { Application } from "@repo/config";
import type { Database } from "@repo/db";
import type * as HttpHeaders from "effect/unstable/http/Headers";
import type { CoreBindings } from "./bindings.ts";

const webHeaders = (headers: HttpHeaders.Headers): Headers => new Headers(headers);

const sessionIdentity = (
  headers: HttpHeaders.Headers,
): Effect.Effect<
  typeof SessionIdentityView.Type,
  SessionRequired | SessionInvalid,
  Auth | Database
> =>
  verifySession(webHeaders(headers), true).pipe(
    Effect.catchTags({
      AdminMfaRequired: (failure) => Effect.die(failure),
      AdminRequired: (failure) => Effect.die(failure),
      DatabaseFailure: (failure) => Effect.die(failure),
      SessionInvalid: () => Effect.fail(new SessionInvalid()),
      SessionRequired: () => Effect.fail(new SessionRequired()),
    }),
  );

const sessionIdentityMiddleware = (
  bindings: CoreBindings,
  audience: Application,
): Layer.Layer<SessionIdentityMiddleware> =>
  Layer.succeed(SessionIdentityMiddleware, (handler, { headers }) =>
    sessionIdentity(headers).pipe(
      Effect.flatMap((identity) => Effect.provideService(handler, SessionIdentity, identity)),
      Effect.provide(authLayer(bindings, audience)),
    ),
  );

export { sessionIdentityMiddleware };
