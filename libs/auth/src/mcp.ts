import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { findWikiReader } from "@template/db/security";
import { httpStatus } from "@template/observability";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { APIError as ChallengeError } from "better-call";
import { Effect, Option, Schema } from "effect";

import { Auth } from "./auth.ts";

import type { BetterAuthInstance } from "./create-auth.ts";

const requiredScopes = ["wiki:read"];
const JSON_RPC_SERVER_ERROR = -32_000;
const Jwk = Schema.StructWithRest(Schema.Struct({ kty: Schema.String }), [
  Schema.Record(Schema.String, Schema.Unknown),
]);
const Jwks = Schema.Struct({ keys: Schema.mutable(Schema.Array(Jwk)) });
const decodeJwks = Schema.decodeUnknownPromise(Jwks);

const bearerToken = (authorization: string): Option.Option<string> => {
  const [scheme, token, ...rest] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" &&
    token !== undefined &&
    token !== "" &&
    rest.length === 0
    ? Option.some(token)
    : Option.none();
};

const fetchJwks = async (
  betterAuthInstance: Readonly<Pick<BetterAuthInstance, "handler">>,
  origin: string,
): ReturnType<typeof decodeJwks> => {
  const jwksResponse = await betterAuthInstance.handler(new Request(`${origin}/api/auth/jwks`));
  return jwksResponse.ok
    ? decodeJwks(await jwksResponse.json())
    : Promise.reject(new Error("WIKI_JWKS_UNAVAILABLE"));
};

const unauthorized = (denialCode: string): APIError => {
  return new APIError("UNAUTHORIZED", { message: denialCode });
};

type TokenSource = {
  readonly betterAuthInstance: Readonly<Pick<BetterAuthInstance, "handler">>;
  readonly origin: string;
  readonly token: string;
};

const verifiedClaims = ({
  betterAuthInstance,
  origin,
  token,
}: TokenSource): Effect.Effect<Awaited<ReturnType<typeof verifyJwsAccessToken>>, APIError> => {
  return Effect.tryPromise({
    catch: () => unauthorized("ACCESS_TOKEN_INVALID"),
    try: async () =>
      verifyJwsAccessToken(token, {
        jwksCacheKey: betterAuthInstance,
        jwksFetch: async () => fetchJwks(betterAuthInstance, origin),
        verifyOptions: { audience: `${origin}/mcp`, issuer: `${origin}/api/auth` },
      }),
  });
};

const scopeError = (claims: Readonly<Record<string, unknown>>): Option.Option<unknown> => {
  const { cnf, scope } = claims;
  if (cnf !== undefined) {
    return Option.some(unauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED"));
  }
  const granted = new Set(typeof scope === "string" ? scope.split(" ") : []);
  const missing = requiredScopes.filter((required) => !granted.has(required));
  return missing.length > 0 ? Option.some(createInsufficientScopeError(missing)) : Option.none();
};

const jsonRpcError = (rpcFailure: {
  readonly responseStatus: number;
  readonly errorCode: string;
  readonly headers?: Readonly<Record<string, string>>;
}): Response => {
  return Response.json(
    {
      error: { code: JSON_RPC_SERVER_ERROR, message: rpcFailure.errorCode },
      id: null,
      jsonrpc: "2.0",
    },
    {
      headers: { ...rpcFailure.headers, "cache-control": "no-store" },
      status: rpcFailure.responseStatus,
    },
  );
};

const challengeResponse = (challengeCause: unknown, resource: string): Response => {
  const challenge = createResourceServerChallenge(challengeCause, resource, {
    challengeScopes: requiredScopes,
  });
  if (!(challenge instanceof ChallengeError)) {
    return jsonRpcError({
      errorCode: "ACCESS_TOKEN_INVALID",
      responseStatus: httpStatus.unauthorized,
    });
  }
  return jsonRpcError({
    errorCode: challenge.message,
    headers: Object.fromEntries(new Headers(challenge.headers)),
    responseStatus: challenge.statusCode,
  });
};

const readerFor = Effect.fn("readerFor")(function* readerFor(tokenSource: TokenSource) {
  const resource = `${tokenSource.origin}/mcp`;
  const claims = yield* Effect.result(verifiedClaims(tokenSource));
  if (claims._tag === "Failure") {
    return challengeResponse(claims.failure, resource);
  }
  const rejected = scopeError(claims.success);
  if (Option.isSome(rejected)) {
    return challengeResponse(rejected.value, resource);
  }
  const { sub } = claims.success;
  const reader = sub === undefined ? undefined : yield* findWikiReader(sub);
  return reader
    ? { userId: reader.id }
    : jsonRpcError({ errorCode: "WIKI_READER_REQUIRED", responseStatus: httpStatus.forbidden });
});

export const authorizeMcpRequest = Effect.fn("authorizeMcpRequest")(function* authorizeMcpRequest(
  incoming: Readonly<{ headers: Readonly<Pick<Headers, "get">> }>,
  origin: string,
) {
  const { instance } = yield* Auth;
  const token = bearerToken(incoming.headers.get("authorization") ?? "");
  if (Option.isNone(token)) {
    return challengeResponse(unauthorized("BEARER_TOKEN_REQUIRED"), `${origin}/mcp`);
  }
  return yield* readerFor({ betterAuthInstance: instance, origin, token: token.value });
});
