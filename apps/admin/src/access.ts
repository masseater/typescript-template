import { createRemoteJWKSet, jwtVerify } from "jose";
import * as v from "valibot";

const localSchema = v.object({
  APP_ORIGIN: v.pipe(v.string(), v.url()),
  LOCAL_ADMIN_USER: v.pipe(v.string(), v.minLength(1)),
  LOCAL_ADMIN_PASSWORD: v.pipe(v.string(), v.minLength(24)),
});
const accessSchema = v.object({
  APP_ORIGIN: v.pipe(v.string(), v.url()),
  ACCESS_ISSUER: v.pipe(
    v.string(),
    v.url(),
    v.check((value) => /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(value)),
  ),
  ACCESS_AUD: v.pipe(v.string(), v.minLength(1)),
});
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function equalCredentials(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [left, right].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
  if (!a || !b) return false;
  const expected = new Uint8Array(b);
  return (
    new Uint8Array(a).reduce(
      (result, value, index) => result | (value ^ (expected[index] ?? 0)),
      0,
    ) === 0
  );
}

const localGateCookie = "local-admin-gate";

async function localGateToken(user: string, password: string): Promise<string> {
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
}

function isLocalOrigin(origin: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
}

export async function localAccessCookie(bindings: unknown): Promise<string | null> {
  const { APP_ORIGIN } = v.parse(v.object({ APP_ORIGIN: v.pipe(v.string(), v.url()) }), bindings);
  if (!isLocalOrigin(APP_ORIGIN)) return null;
  const config = v.parse(localSchema, bindings);
  const token = await localGateToken(config.LOCAL_ADMIN_USER, config.LOCAL_ADMIN_PASSWORD);
  return `${localGateCookie}=${token}; Path=/; HttpOnly; SameSite=Strict`;
}

export async function enforceAdminAccess(
  request: Request,
  bindings: unknown,
): Promise<Response | null> {
  const { APP_ORIGIN } = v.parse(v.object({ APP_ORIGIN: v.pipe(v.string(), v.url()) }), bindings);
  const local = isLocalOrigin(APP_ORIGIN);
  const unauthorized = () =>
    new Response("Authentication required", {
      status: 401,
      headers: {
        "cache-control": "no-store",
        ...(local
          ? { "www-authenticate": 'Basic realm="Local administrator access", charset="UTF-8"' }
          : {}),
      },
    });
  if (new URL(request.url).origin !== APP_ORIGIN) return unauthorized();
  if (local) {
    const config = v.parse(localSchema, bindings);
    const gate = request.headers
      .get("cookie")
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${localGateCookie}=`))
      ?.slice(localGateCookie.length + 1);
    if (
      gate &&
      (await equalCredentials(
        gate,
        await localGateToken(config.LOCAL_ADMIN_USER, config.LOCAL_ADMIN_PASSWORD),
      ))
    )
      return null;
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Basic ")) return unauthorized();
    let credentials: string;
    try {
      credentials = atob(authorization.slice(6));
    } catch {
      return unauthorized();
    }
    return (await equalCredentials(
      credentials,
      `${config.LOCAL_ADMIN_USER}:${config.LOCAL_ADMIN_PASSWORD}`,
    ))
      ? null
      : unauthorized();
  }
  const config = v.parse(accessSchema, bindings);
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return unauthorized();
  const keySet =
    keys.get(config.ACCESS_ISSUER) ??
    createRemoteJWKSet(new URL(`${config.ACCESS_ISSUER}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
    });
  keys.set(config.ACCESS_ISSUER, keySet);
  try {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: config.ACCESS_ISSUER,
      audience: config.ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "aud", "iss"],
    });
    if (!payload.sub) return unauthorized();
    return null;
  } catch {
    return unauthorized();
  }
}
