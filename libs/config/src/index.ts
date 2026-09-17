import type { D1Database } from "@cloudflare/workers-types";
import * as v from "valibot";

export const applications = ["user", "admin", "wiki"] as const;
export type Application = (typeof applications)[number];
export const applicationPorts = { user: 3001, admin: 3002, wiki: 3003 } satisfies Record<
  Application,
  number
>;
export const roles = ["user", "admin"] as const;
export type Role = (typeof roles)[number];
export const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
export type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];
export const authenticationMethods = [
  "password",
  ...strongAuthenticationMethods,
  "recovery",
] as const;
export const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];

const release = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9._-]{1,64}$/));
const origin = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => URL.parse(value)?.origin === value, "An origin without a path is required"),
);
const scalarSchema = v.object({
  APP_ORIGIN: origin,
  AUTH_SECRET: v.pipe(v.string(), v.minLength(32)),
  APP_RELEASE: v.optional(release, "local"),
  EMAIL_FROM: v.pipe(v.string(), v.email()),
  MAILPIT_URL: v.optional(origin),
});

export function isLocalDevelopmentOrigin(value: string): boolean {
  const url = new URL(value);
  return (
    loopbackHosts.includes(url.hostname) ||
    (url.protocol === "https:" && /^[a-z0-9-]+\.local$/.test(url.hostname))
  );
}

function requireSecureOrigin(value: string) {
  const url = new URL(value);
  if (!loopbackHosts.includes(url.hostname) && url.protocol !== "https:")
    throw new Error("HTTPS is required outside localhost");
}

export type EmailMessage = { to: string; from: string; subject: string; text: string };
export type EmailBinding = { send(message: EmailMessage): Promise<unknown> };
type AssetBinding = { fetch(request: Request): Promise<Response> };
type AiBinding = { run(model: string, inputs: { text: string[] }): Promise<unknown> };

function hasFunction(value: unknown, key: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    key in value &&
    typeof Reflect.get(value, key) === "function"
  );
}

export function readEnvironment(input: unknown) {
  const scalars = v.parse(scalarSchema, input);
  requireSecureOrigin(scalars.APP_ORIGIN);
  const local = isLocalDevelopmentOrigin(scalars.APP_ORIGIN);
  if (
    scalars.MAILPIT_URL &&
    (!local || !loopbackHosts.includes(new URL(scalars.MAILPIT_URL).hostname))
  )
    throw new Error("Mailpit is restricted to local development");
  return { ...scalars, local };
}

export function readConfig(input: unknown) {
  const scalars = readEnvironment(input);
  const bindings = v.parse(
    v.object({
      DB: v.custom<D1Database>(
        (value) => hasFunction(value, "prepare") && hasFunction(value, "batch"),
      ),
      ASSETS: v.custom<AssetBinding>((value) => hasFunction(value, "fetch")),
      EMAIL: v.optional(v.custom<EmailBinding>((value) => hasFunction(value, "send"))),
    }),
    input,
  );
  if (!scalars.MAILPIT_URL && !bindings.EMAIL)
    throw new Error("An email delivery binding is required");
  return { ...scalars, ...bindings };
}

export type AppConfig = ReturnType<typeof readConfig>;

export async function sendVerificationEmail(
  config: Pick<AppConfig, "APP_ORIGIN" | "EMAIL_FROM" | "MAILPIT_URL" | "EMAIL">,
  message: { email: string; url: string },
): Promise<void> {
  if (new URL(message.url).origin !== config.APP_ORIGIN)
    throw new Error("Email link origin mismatch");
  const email: EmailMessage = {
    from: config.EMAIL_FROM,
    to: message.email,
    subject: "メールアドレスの確認",
    text: `次のリンクでメールアドレスを確認してください。\n${message.url}`,
  };
  if (config.MAILPIT_URL) {
    const response = await fetch(`${config.MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        From: { Email: email.from },
        To: [{ Email: email.to }],
        Subject: email.subject,
        Text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    if (!response.ok) throw new Error(`Email delivery failed (${response.status})`);
    return;
  }
  if (!config.EMAIL) throw new Error("Email delivery binding is missing");
  await config.EMAIL.send(email);
}

export function readWikiConfig(input: unknown) {
  const { AI } = v.parse(
    v.object({ AI: v.optional(v.custom<AiBinding>((value) => hasFunction(value, "run"))) }),
    input,
  );
  return { ...readConfig(input), AI: AI ?? null };
}
