import { array, looseObject, object, parse, string } from "valibot";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { APIError } from "better-auth/api";
import { APIError as ChallengeError } from "better-call";
import type { Database } from "@template/db";
import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { findWikiReader } from "@template/db/security";

interface AuthHandler {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly handler: (request: Request) => Promise<Response>;
}

interface McpAuthorization {
  readonly auth: AuthHandler;
  readonly database: Database;
  readonly origin: string;
  readonly request: Readonly<{ headers: Readonly<Pick<Headers, "get">> }>;
}

type TokenClaims = Awaited<ReturnType<typeof verifyJwsAccessToken>>;

const wikiScopes = ["wiki:read", "offline_access"] as const;
const requiredScopes = ["wiki:read"];
const jwkSchema = looseObject({ kty: string() });
const jwksSchema = object({ keys: array(jwkSchema) });
const JSON_RPC_SERVER_ERROR = -32_000;
const FORBIDDEN = 403;

function unauthorized(message: string): APIError {
  return new APIError("UNAUTHORIZED", { message });
}

function jsonRpcError(
  status: number,
  message: string,
  headers: Readonly<Record<string, string>>,
): Response {
  return Response.json(
    // oxlint-disable-next-line unicorn/no-null
    { error: { code: JSON_RPC_SERVER_ERROR, message }, id: null, jsonrpc: "2.0" },
    { headers: { ...headers, "cache-control": "no-store" }, status },
  );
}

function bearerToken(authorization: string): string {
  const [scheme, token, ...rest] = authorization.split(" ");
  if (
    scheme?.toLowerCase() !== "bearer" ||
    token === undefined ||
    token === "" ||
    rest.length > 0
  ) {
    throw unauthorized("BEARER_TOKEN_REQUIRED");
  }
  return token;
}

async function verifiedClaims(
  { auth, origin }: Readonly<{ auth: AuthHandler; origin: string }>,
  token: string,
): Promise<TokenClaims> {
  try {
    return await verifyJwsAccessToken(token, {
      jwksCacheKey: auth,
      jwksFetch: async () => {
        const response = await auth.handler(new Request(`${origin}/api/auth/jwks`));
        if (!response.ok) {
          throw new Error("WIKI_JWKS_UNAVAILABLE");
        }
        return parse(jwksSchema, await response.json());
      },
      verifyOptions: { audience: `${origin}/mcp`, issuer: `${origin}/api/auth` },
    });
  } catch {
    throw unauthorized("ACCESS_TOKEN_INVALID");
  }
}

function assertScopes(claims: Readonly<Record<string, unknown>>): void {
  const { cnf, scope } = claims;
  if (cnf !== undefined) {
    throw unauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED");
  }
  const granted = new Set(typeof scope === "string" ? scope.split(" ") : []);
  const missing = requiredScopes.filter((required) => !granted.has(required));
  if (missing.length > 0) {
    throw createInsufficientScopeError(missing);
  }
}

async function authorizedReader(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  options: McpAuthorization,
): Promise<Readonly<{ userId: string }> | Response> {
  const token = bearerToken(options.request.headers.get("authorization") ?? "");
  const claims = await verifiedClaims(options, token);
  assertScopes(claims);
  const reader =
    claims.sub === undefined ? undefined : await findWikiReader(options.database, claims.sub);
  if (reader === undefined) {
    return jsonRpcError(FORBIDDEN, "WIKI_READER_REQUIRED", {});
  }
  return { userId: reader.id };
}

function challengeResponse(error: unknown, resource: string): Response {
  const challenge = createResourceServerChallenge(error, resource, {
    challengeScopes: requiredScopes,
  });
  if (!(challenge instanceof ChallengeError)) {
    throw error;
  }
  const headers = Object.fromEntries(new Headers(challenge.headers));
  return jsonRpcError(challenge.statusCode, challenge.message, headers);
}

async function authorizeMcpRequest(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  options: McpAuthorization,
): Promise<Readonly<{ userId: string }> | Response> {
  try {
    return await authorizedReader(options);
  } catch (error) {
    return challengeResponse(error, `${options.origin}/mcp`);
  }
}

export { authorizeMcpRequest, wikiScopes };
