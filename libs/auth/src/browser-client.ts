import type { Auth } from "./index.ts";
import { URI } from "otpauth";
import { expect } from "vitest";

interface TotpEnrollment {
  readonly authenticator: ReturnType<typeof URI.parse>;
  readonly backupCodes: string[];
}

const PASSWORD = "test-password-safe-123";
const HTTP_OK = 200;
const HTTP_FOUND = 302;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

function storeCookie(cookies: Map<string, string>, header: string): void {
  const [pair] = header.split(";");
  if (pair === undefined || pair === "") {
    return;
  }
  const separator = pair.indexOf("=");
  const key = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  if (value === "") {
    cookies.delete(key);
    return;
  }
  cookies.set(key, value);
}

class BrowserClient {
  public readonly cookies = new Map<string, string>();
  public readonly auth: Auth;
  public readonly origin: string;

  public constructor(auth: Auth, origin: string) {
    this.auth = auth;
    this.origin = origin;
  }

  public headers(): Headers {
    return new Headers({
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "),
      origin: this.origin,
    });
  }

  public async request(
    endpoint: string,
    body?: Readonly<Record<string, unknown>>,
  ): Promise<Response> {
    const headers = this.headers();
    headers.set("content-type", "application/json");
    const response = await this.auth.handler(
      new Request(`${this.origin}/api/auth${endpoint}`, {
        headers,
        method: body ? "POST" : "GET",
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    for (const cookie of response.headers.getSetCookie()) {
      storeCookie(this.cookies, cookie);
    }
    return response;
  }
}

async function signIn(client: BrowserClient, email: string): Promise<Response> {
  return client.request("/sign-in/email", { email, password: PASSWORD });
}

async function expectSignedIn(client: BrowserClient, email: string): Promise<void> {
  const response = await signIn(client, email);
  expect(response.status).toBe(HTTP_OK);
}

function isEnrollment(data: unknown): data is { backupCodes: string[]; totpURI: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "totpURI" in data &&
    typeof data.totpURI === "string" &&
    "backupCodes" in data &&
    Array.isArray(data.backupCodes) &&
    data.backupCodes.every((code: unknown): code is string => typeof code === "string")
  );
}

async function enableTotp(client: BrowserClient): Promise<TotpEnrollment> {
  const response = await client.request("/two-factor/enable", { password: PASSWORD });
  expect(response.status).toBe(HTTP_OK);
  const data: unknown = await response.json();
  if (!isEnrollment(data)) {
    throw new Error("TOTP_ENROLLMENT_FAILED");
  }
  const authenticator = URI.parse(data.totpURI);
  const verified = await client.request("/two-factor/verify-totp", {
    code: authenticator.generate(),
  });
  expect(verified.status).toBe(HTTP_OK);
  return { authenticator, backupCodes: data.backupCodes };
}

export {
  BrowserClient,
  HTTP_FORBIDDEN,
  HTTP_FOUND,
  HTTP_NOT_FOUND,
  HTTP_OK,
  PASSWORD,
  enableTotp,
  expectSignedIn,
  signIn,
};
export type { TotpEnrollment };
