import { isLocalDevelopmentOrigin } from "@template/config";
import { Effect, Option, Result, Schema } from "effect";
import { createRemoteJWKSet, jwtVerify } from "jose";

class AccessConfigurationInvalid extends Schema.TaggedError<AccessConfigurationInvalid>()(
  "AccessConfigurationInvalid",
  { field: Schema.String },
) {}

const AbsoluteUrl = Schema.String.check(Schema.makeFilter((value: string) => URL.canParse(value)));

const Origin = Schema.Struct({ APP_ORIGIN: AbsoluteUrl });

const LocalAccess = Schema.Struct({
  APP_ORIGIN: AbsoluteUrl,
  LOCAL_ADMIN_USER: Schema.String.check(Schema.isMinLength(1)),
  LOCAL_ADMIN_PASSWORD: Schema.String.check(Schema.isMinLength(24)),
});

const CloudflareAccess = Schema.Struct({
  APP_ORIGIN: AbsoluteUrl,
  ACCESS_ISSUER: AbsoluteUrl.check(
    Schema.isPattern(/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/),
  ),
  ACCESS_AUD: Schema.String.check(Schema.isMinLength(1)),
});

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(
  schema: S,
  input: unknown,
) =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(
      (error) =>
        new AccessConfigurationInvalid({
          field: /\["([A-Z_]+)"\]/.exec(error.message)?.[1] ?? "unknown",
        }),
    ),
  );

const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const localGateCookie = "local-admin-gate";

const digest = (value: string) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

const equalCredentials = Effect.fn(function* (left: string, right: string) {
  const [a, b] = yield* Effect.all([digest(left), digest(right)]);
  const expected = new Uint8Array(b);
  return (
    new Uint8Array(a).reduce(
      (result, value, index) => result | (value ^ (expected[index] ?? 0)),
      0,
    ) === 0
  );
});

const localGateToken = (user: string, password: string) =>
  Effect.promise(async () => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${localGateCookie}:${user}`),
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
  });

export const localAccessCookie = Effect.fn("localAccessCookie")(function* (env: unknown) {
  const { APP_ORIGIN } = yield* decode(Origin, env);
  if (!isLocalDevelopmentOrigin(APP_ORIGIN)) return null;
  const config = yield* decode(LocalAccess, env);
  const token = yield* localGateToken(config.LOCAL_ADMIN_USER, config.LOCAL_ADMIN_PASSWORD);
  return `${localGateCookie}=${token}; Path=/; HttpOnly; SameSite=Strict`;
});

const verifyAccessAssertion = (token: string, config: typeof CloudflareAccess.Type) => {
  const keySet =
    keys.get(config.ACCESS_ISSUER) ??
    createRemoteJWKSet(new URL(`${config.ACCESS_ISSUER}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
    });
  keys.set(config.ACCESS_ISSUER, keySet);
  return Effect.tryPromise(() =>
    jwtVerify(token, keySet, {
      issuer: config.ACCESS_ISSUER,
      audience: config.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "aud", "iss"],
    }),
  ).pipe(Effect.option, Effect.map(Option.exists(({ payload }) => Boolean(payload.sub))));
};

export const enforceAdminAccess = Effect.fn("enforceAdminAccess")(function* (
  request: Request,
  env: unknown,
) {
  const { APP_ORIGIN } = yield* decode(Origin, env);
  const local = isLocalDevelopmentOrigin(APP_ORIGIN);
  const unauthorized = new Response("Authentication required", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      ...(local
        ? { "www-authenticate": 'Basic realm="Local administrator access", charset="UTF-8"' }
        : {}),
    },
  });
  if (new URL(request.url).origin !== APP_ORIGIN) return unauthorized;
  if (local) {
    const config = yield* decode(LocalAccess, env);
    const expected = yield* localGateToken(config.LOCAL_ADMIN_USER, config.LOCAL_ADMIN_PASSWORD);
    const gate = request.headers
      .get("cookie")
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${localGateCookie}=`))
      ?.slice(localGateCookie.length + 1);
    if (gate !== undefined && (yield* equalCredentials(gate, expected))) return null;
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Basic ")) return unauthorized;
    const credentials = Result.try(() => atob(authorization.slice(6)));
    if (Result.isFailure(credentials)) return unauthorized;
    return (yield* equalCredentials(
      credentials.success,
      `${config.LOCAL_ADMIN_USER}:${config.LOCAL_ADMIN_PASSWORD}`,
    ))
      ? null
      : unauthorized;
  }
  const config = yield* decode(CloudflareAccess, env);
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return unauthorized;
  return (yield* verifyAccessAssertion(token, config)) ? null : unauthorized;
});
