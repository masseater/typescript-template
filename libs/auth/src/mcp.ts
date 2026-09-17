import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import type { Database } from "@template/db";
import { findWikiReader } from "@template/db/security";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { APIError as ChallengeError } from "better-call";
import * as v from "valibot";

export const wikiScopes = ["wiki:read", "offline_access"] as const;
const requiredScopes = ["wiki:read"];
const jwksSchema = v.object({ keys: v.array(v.looseObject({ kty: v.string() })) });

type AuthHandler = { handler: (request: Request) => Promise<Response> };

function unauthorized(message: string) {
  return new APIError("UNAUTHORIZED", { message });
}

export async function authorizeMcpRequest(options: {
  auth: AuthHandler;
  database: Database;
  origin: string;
  request: Request;
}): Promise<{ userId: string } | Response> {
  const resource = `${options.origin}/mcp`;
  try {
    const authorization = options.request.headers.get("authorization") ?? "";
    const [scheme, token, ...rest] = authorization.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0)
      throw unauthorized("BEARER_TOKEN_REQUIRED");
    const claims = await verifyJwsAccessToken(token, {
      jwksFetch: async () => {
        const response = await options.auth.handler(new Request(`${options.origin}/api/auth/jwks`));
        if (!response.ok) throw new Error("WIKI_JWKS_UNAVAILABLE");
        return v.parse(jwksSchema, await response.json());
      },
      jwksCacheKey: options.auth,
      verifyOptions: { issuer: `${options.origin}/api/auth`, audience: resource },
    }).catch(() => {
      throw unauthorized("ACCESS_TOKEN_INVALID");
    });
    if (claims["cnf"] !== undefined) throw unauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED");
    const granted = new Set(typeof claims["scope"] === "string" ? claims["scope"].split(" ") : []);
    const missing = requiredScopes.filter((scope) => !granted.has(scope));
    if (missing.length > 0) throw createInsufficientScopeError(missing);
    const reader = claims.sub ? await findWikiReader(options.database, claims.sub) : null;
    if (!reader) return jsonRpcError(403, "WIKI_READER_REQUIRED", new Headers());
    return { userId: reader.id };
  } catch (error) {
    const challenge = createResourceServerChallenge(error, resource, {
      challengeScopes: requiredScopes,
    });
    if (!(challenge instanceof ChallengeError)) throw error;
    return jsonRpcError(challenge.statusCode, challenge.message, new Headers(challenge.headers));
  }
}

function jsonRpcError(status: number, message: string, headers: Headers) {
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }),
    { status, headers },
  );
}
