import { Auth, handleAuthRequest, type AuthOptions } from "@repo/auth";
import { applicationOrigins, type Application } from "@repo/config";
import { Database } from "@repo/db";
import { Effect, Layer } from "effect";

import type { CoreBindings } from "./bindings.ts";

const mailFrom = (bindings: CoreBindings, origin: string): AuthOptions["mail"] => ({
  APP_ORIGIN: origin,
  EMAIL: bindings.EMAIL,
  EMAIL_FROM: bindings.EMAIL_FROM,
});

const authOptionsFor = (
  bindings: CoreBindings,
  audience: Application,
  origin: string,
): AuthOptions => ({
  audience,
  baseURL: origin,
  mail: mailFrom(bindings, origin),
  secret: bindings.AUTH_SECRET,
});

const audienceOrigin = (audience: Application): string => applicationOrigins[audience];

const authLayer = (
  bindings: CoreBindings,
  audience: Application,
  origin: string = audienceOrigin(audience),
): Layer.Layer<Auth | Database> =>
  Auth.layer(authOptionsFor(bindings, audience, origin)).pipe(
    Layer.provideMerge(Database.layer(bindings.DB)),
    Layer.orDie,
  );

const handleForwardedAuth = (
  bindings: CoreBindings,
  audience: Application,
  request: Request,
): Effect.Effect<Response> =>
  handleAuthRequest(request).pipe(
    Effect.provide(authLayer(bindings, audience, new URL(request.url).origin)),
    Effect.orDie,
  );

export { audienceOrigin, authLayer, handleForwardedAuth };
