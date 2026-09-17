import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { findWikiReader } from "@template/db/security";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { APIError as ChallengeError } from "better-call";
import { Effect, Schema } from "effect";
import { Auth } from "./index.ts";

const requiredScopes = ["wiki:read"];
const Jwks = Schema.Struct({
  keys: Schema.mutable(
    Schema.Array(
      Schema.StructWithRest(Schema.Struct({ kty: Schema.String }), [
        Schema.Record(Schema.String, Schema.Unknown),
      ]),
    ),
  ),
});

function jsonRpcError(status: number, message: string, headers: Headers) {
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }),
    { status, headers },
  );
}

const unauthorized = (message: string) => new APIError("UNAUTHORIZED", { message });

export const authorizeMcpRequest = Effect.fn("authorizeMcpRequest")(function* (
  request: Request,
  origin: string,
) {
  const { instance } = yield* Auth;
  const resource = `${origin}/mcp`;
  const challenge = (error: unknown) => {
    const response = createResourceServerChallenge(error, resource, {
      challengeScopes: requiredScopes,
    });
    return response instanceof ChallengeError
      ? jsonRpcError(response.statusCode, response.message, new Headers(response.headers))
      : jsonRpcError(401, "ACCESS_TOKEN_INVALID", new Headers());
  };
  const [scheme, token, ...rest] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0)
    return challenge(unauthorized("BEARER_TOKEN_REQUIRED"));
  const claims = yield* Effect.tryPromise(() =>
    verifyJwsAccessToken(token, {
      jwksFetch: async () => {
        const response = await instance.handler(new Request(`${origin}/api/auth/jwks`));
        return response.ok
          ? Schema.decodeUnknownPromise(Jwks)(await response.json())
          : Promise.reject(new Error("WIKI_JWKS_UNAVAILABLE"));
      },
      jwksCacheKey: instance,
      verifyOptions: { issuer: `${origin}/api/auth`, audience: resource },
    }),
  ).pipe(Effect.option);
  if (claims._tag === "None") return challenge(unauthorized("ACCESS_TOKEN_INVALID"));
  if (claims.value["cnf"] !== undefined)
    return challenge(unauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED"));
  const scope = claims.value["scope"];
  const granted = new Set(typeof scope === "string" ? scope.split(" ") : []);
  const missing = requiredScopes.filter((required) => !granted.has(required));
  if (missing.length > 0) return challenge(createInsufficientScopeError(missing));
  const subject = claims.value.sub;
  const reader = subject ? yield* findWikiReader(subject) : null;
  if (!reader) return jsonRpcError(403, "WIKI_READER_REQUIRED", new Headers());
  return { userId: reader.id };
});
