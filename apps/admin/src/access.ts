import { check, minLength, object, parse, pipe, string, url } from "valibot";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { isLocalDevelopmentOrigin } from "@template/config";

const localAdminPasswordMinLength = 24;
const basicScheme = "Basic ";
const localGateCookie = "local-admin-gate";

const appOriginSchema = pipe(string(), url());
const originSchema = object({ APP_ORIGIN: appOriginSchema });
const localAccessSchema = object({
  APP_ORIGIN: appOriginSchema,
  LOCAL_ADMIN_PASSWORD: pipe(string(), minLength(localAdminPasswordMinLength)),
  LOCAL_ADMIN_USER: pipe(string(), minLength(1)),
});
const accessSchema = object({
  ACCESS_AUD: pipe(string(), minLength(1)),
  ACCESS_ISSUER: pipe(
    string(),
    url(),
    check((value) => /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/u.test(value)),
  ),
  APP_ORIGIN: appOriginSchema,
});
const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function equalCredentials(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const expected = new Uint8Array(rightDigest);
  return (
    new Uint8Array(leftDigest).reduce(
      // oxlint-disable-next-line no-bitwise
      (result, value, index) => result | (value ^ (expected[index] ?? 0)),
      0,
    ) === 0
  );
}

async function localGateToken(user: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${localGateCookie}:${user}`),
  );
  return btoa(String.fromCodePoint(...new Uint8Array(signature)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function localAccessCookie(bindings: unknown): Promise<string | undefined> {
  const { APP_ORIGIN } = parse(originSchema, bindings);
  if (!isLocalDevelopmentOrigin(APP_ORIGIN)) {
    return undefined;
  }
  const config = parse(localAccessSchema, bindings);
  const token = await localGateToken(config.LOCAL_ADMIN_USER, config.LOCAL_ADMIN_PASSWORD);
  return `${localGateCookie}=${token}; Path=/; HttpOnly; SameSite=Strict`;
}

function unauthorized(local: boolean): Response {
  return new Response("Authentication required", {
    headers: {
      "cache-control": "no-store",
      ...(local
        ? { "www-authenticate": 'Basic realm="Local administrator access", charset="UTF-8"' }
        : {}),
    },
    status: 401,
  });
}

type RequestHeaders = Readonly<Pick<Headers, "get">>;

function localGate(headers: RequestHeaders): string | undefined {
  return headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${localGateCookie}=`))
    ?.slice(localGateCookie.length + 1);
}

function basicCredentials(headers: RequestHeaders): string | undefined {
  const authorization = headers.get("authorization");
  if (authorization?.startsWith(basicScheme) !== true) {
    return undefined;
  }
  try {
    return atob(authorization.slice(basicScheme.length));
  } catch {
    return undefined;
  }
}

async function enforceLocalAccess(
  headers: RequestHeaders,
  bindings: unknown,
): Promise<Response | undefined> {
  const config = parse(localAccessSchema, bindings);
  const gate = localGate(headers);
  if (
    gate !== undefined &&
    (await equalCredentials(
      gate,
      await localGateToken(config.LOCAL_ADMIN_USER, config.LOCAL_ADMIN_PASSWORD),
    ))
  ) {
    return undefined;
  }
  const credentials = basicCredentials(headers);
  if (credentials === undefined) {
    return unauthorized(true);
  }
  return (await equalCredentials(
    credentials,
    `${config.LOCAL_ADMIN_USER}:${config.LOCAL_ADMIN_PASSWORD}`,
  ))
    ? undefined
    : unauthorized(true);
}

async function enforceCloudflareAccess(
  headers: RequestHeaders,
  bindings: unknown,
): Promise<Response | undefined> {
  const config = parse(accessSchema, bindings);
  const token = headers.get("cf-access-jwt-assertion");
  if (token === null || token === "") {
    return unauthorized(false);
  }
  const keySet =
    keys.get(config.ACCESS_ISSUER) ??
    createRemoteJWKSet(new URL(`${config.ACCESS_ISSUER}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
    });
  keys.set(config.ACCESS_ISSUER, keySet);
  try {
    const { payload } = await jwtVerify(token, keySet, {
      algorithms: ["RS256"],
      audience: config.ACCESS_AUD,
      issuer: config.ACCESS_ISSUER,
      requiredClaims: ["exp", "iat", "sub", "aud", "iss"],
    });
    return payload.sub === undefined || payload.sub === "" ? unauthorized(false) : undefined;
  } catch {
    return unauthorized(false);
  }
}

async function enforceAdminAccess(
  request: Readonly<{ headers: RequestHeaders; url: string }>,
  bindings: unknown,
): Promise<Response | undefined> {
  const { APP_ORIGIN } = parse(originSchema, bindings);
  const local = isLocalDevelopmentOrigin(APP_ORIGIN);
  if (new URL(request.url).origin !== APP_ORIGIN) {
    return unauthorized(local);
  }
  if (local) {
    return enforceLocalAccess(request.headers, bindings);
  }
  return enforceCloudflareAccess(request.headers, bindings);
}

export { enforceAdminAccess, localAccessCookie };
