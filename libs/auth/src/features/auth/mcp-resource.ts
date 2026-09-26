import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { httpStatus } from "@repo/config";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { APIError as ChallengeError } from "better-call";
import { Effect, Option, Schema } from "effect";

import { Auth } from "./auth.ts";
import { JwksUnavailable } from "./jwks-unavailable.ts";

import type { BetterAuthInstance } from "./create-auth.ts";

const JSON_RPC_SERVER_ERROR = -32_000;
const mcpJsonRpcError = (
  rejection: Readonly<{
    headers?: Readonly<Record<string, string>>;
    message: string;
    status: number;
  }>,
): Response =>
  Response.json(
    {
      error: { code: JSON_RPC_SERVER_ERROR, message: rejection.message },
      id: null,
      jsonrpc: "2.0",
    },
    { headers: { ...rejection.headers, "cache-control": "no-store" }, status: rejection.status },
  );

type McpResource = Readonly<{ challengeScopes: readonly string[]; origin: string }>;
const challengeResponse = (rejected: unknown, resource: McpResource): Response => {
  const challenge = createResourceServerChallenge(rejected, `${resource.origin}/mcp`, {
    challengeScopes: [...resource.challengeScopes],
  });
  if (!(challenge instanceof ChallengeError)) {
    return mcpJsonRpcError({ message: "ACCESS_TOKEN_INVALID", status: httpStatus.unauthorized });
  }
  return mcpJsonRpcError({
    headers: Object.fromEntries(new Headers(challenge.headers)),
    message: challenge.message,
    status: challenge.statusCode,
  });
};

const bearerToken = (authorization: string): Option.Option<string> => {
  const [scheme, token, ...rest] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" &&
    token !== undefined &&
    token !== "" &&
    rest.length === 0
    ? Option.some(token)
    : Option.none();
};

const Jwk = Schema.StructWithRest(Schema.Struct({ kty: Schema.String }), [
  Schema.Record(Schema.String, Schema.Unknown),
]);
const Jwks = Schema.Struct({ keys: Schema.mutable(Schema.Array(Jwk)) });

const mcpUnauthorized = (reason: string): APIError =>
  new APIError("UNAUTHORIZED", { message: reason });

const grantedScopesOf = (scope: unknown): ReadonlySet<string> =>
  new Set(typeof scope === "string" ? scope.split(" ") : []);

type McpTokenSubject = Readonly<{ sid: unknown; sub: string | undefined }>;
type McpResourcePolicy<Actor, Failure, Requirements> = Readonly<{
  actorOf: (
    subject: McpTokenSubject,
    granted: ReadonlySet<string>,
  ) => Effect.Effect<Actor | Response, Failure, Requirements>;
  challengeScopes: readonly string[];
  scopeError: (granted: ReadonlySet<string>) => Option.Option<unknown>;
}>;
const tokenRejection = <Actor, Failure, Requirements>(
  presented: Readonly<{ cnf: unknown; scope: unknown }>,
  policy: McpResourcePolicy<Actor, Failure, Requirements>,
): Option.Option<unknown> =>
  presented.cnf === undefined
    ? policy.scopeError(grantedScopesOf(presented.scope))
    : Option.some(mcpUnauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED"));

type ResourceAuth = Readonly<Pick<BetterAuthInstance, "handler">>;

const publishedJwks = (
  issuer: ResourceAuth,
  origin: string,
): Effect.Effect<typeof Jwks.Type, JwksUnavailable> =>
  Effect.gen(function* publishedJwks() {
    const { handler } = issuer;
    if (typeof handler !== "function") {
      return yield* JwksUnavailable.make();
    }
    const published: unknown = yield* Effect.tryPromise({
      catch: () => JwksUnavailable.make(),
      try: () => Promise.resolve(handler(new Request(`${origin}/api/auth/jwks`))),
    });
    if (!(published instanceof Response) || !published.ok) {
      return yield* JwksUnavailable.make();
    }
    const keySet: unknown = yield* Effect.tryPromise({
      catch: () => JwksUnavailable.make(),
      try: () => published.json(),
    });
    return yield* Schema.decodeUnknownEffect(Jwks)(keySet).pipe(
      Effect.mapError(() => JwksUnavailable.make()),
    );
  });

const verifiedClaims = (
  issuer: ResourceAuth,
  presented: Readonly<{ origin: string; token: string }>,
): Effect.Effect<Readonly<Awaited<ReturnType<typeof verifyJwsAccessToken>>>, APIError> =>
  Effect.tryPromise({
    catch: () => mcpUnauthorized("ACCESS_TOKEN_INVALID"),
    try: () =>
      verifyJwsAccessToken(presented.token, {
        jwksCacheKey: issuer,
        jwksFetch: () => Effect.runPromise(publishedJwks(issuer, presented.origin)),
        verifyOptions: {
          audience: `${presented.origin}/mcp`,
          issuer: `${presented.origin}/api/auth`,
        },
      }),
  });

const authorizedActor = <Actor, Failure, Requirements>(
  issuer: ResourceAuth,
  presented: Readonly<{
    policy: McpResourcePolicy<Actor, Failure, Requirements>;
    resource: McpResource;
    token: string;
  }>,
): Effect.Effect<Actor | Response, Failure, Requirements> =>
  Effect.gen(function* authorizedActor() {
    const { policy, resource } = presented;
    const claims = yield* Effect.result(
      verifiedClaims(issuer, { origin: resource.origin, token: presented.token }),
    );
    if (claims._tag === "Failure") {
      return challengeResponse(claims.failure, resource);
    }
    const { cnf, scope, sid, sub } = claims.success;
    const rejected = tokenRejection({ cnf, scope }, policy);
    if (Option.isSome(rejected)) {
      return challengeResponse(rejected.value, resource);
    }
    return yield* policy.actorOf({ sid, sub }, grantedScopesOf(scope));
  });

const mcpAuthorizer = <Actor, Failure, Requirements>(
  policy: McpResourcePolicy<Actor, Failure, Requirements>,
): ((
  incoming: Readonly<{ headers: Readonly<Pick<Headers, "get">> }>,
  origin: string,
) => Effect.Effect<Actor | Response, Failure, Requirements | Auth>) =>
  Effect.fn("authorizeMcpRequest")(function* authorizeMcpRequest(incoming, origin) {
    const resource = { challengeScopes: policy.challengeScopes, origin };
    const token = bearerToken(incoming.headers.get("authorization") ?? "");
    if (Option.isNone(token)) {
      return challengeResponse(mcpUnauthorized("BEARER_TOKEN_REQUIRED"), resource);
    }
    const { instance } = yield* Auth;
    return yield* authorizedActor(instance, { policy, resource, token: token.value });
  });

const insufficientScopeError = (
  requiredScopes: readonly string[],
  granted: ReadonlySet<string>,
): Option.Option<unknown> => {
  const missing = requiredScopes.filter((required) => !granted.has(required));
  return missing.length > 0 ? Option.some(createInsufficientScopeError(missing)) : Option.none();
};

export { insufficientScopeError, mcpAuthorizer, mcpJsonRpcError, mcpUnauthorized };
export type { McpResourcePolicy, McpTokenSubject };
