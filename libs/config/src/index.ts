import {
  check,
  custom,
  email,
  minLength,
  object,
  optional,
  parse,
  pipe,
  regex,
  string,
  url,
} from "valibot";
import type { D1Database } from "@cloudflare/workers-types";
import type { InferOutput } from "valibot";

interface EmailMessage {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly text: string;
}
interface EmailBinding {
  readonly send: (message: EmailMessage) => Promise<unknown>;
}
interface AssetBinding {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request) => Promise<Response>;
}
interface AiBinding {
  readonly run: (model: string, inputs: { readonly text: readonly string[] }) => Promise<unknown>;
}

const minimumAuthSecretLength = 32;
const mailpitTimeoutMilliseconds = 10_000;

const absoluteUrl = pipe(string(), url());
const release = pipe(string(), regex(/^[a-zA-Z0-9._-]{1,64}$/u));
const origin = pipe(
  absoluteUrl,
  check((value) => URL.parse(value)?.origin === value, "An origin without a path is required"),
);
const scalarSchema = object({
  APP_ORIGIN: origin,
  APP_RELEASE: optional(release, "local"),
  AUTH_SECRET: pipe(string(), minLength(minimumAuthSecretLength)),
  EMAIL_FROM: pipe(string(), email()),
  MAILPIT_URL: optional(origin),
});

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hasFunction(value: unknown, key: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    key in value &&
    typeof Reflect.get(value, key) === "function"
  );
}

const assetBindingSchema = custom<AssetBinding>((value) => hasFunction(value, "fetch"));
const bindingSchema = object({
  ASSETS: assetBindingSchema,
  DB: custom<D1Database>((value) => hasFunction(value, "prepare") && hasFunction(value, "batch")),
  EMAIL: optional(custom<EmailBinding>((value) => hasFunction(value, "send"))),
});
const wikiSchema = object({
  AI: optional(custom<AiBinding>((value) => hasFunction(value, "run"))),
});

type Environment = InferOutput<typeof scalarSchema> & { local: boolean };
type AppConfig = Environment & InferOutput<typeof bindingSchema>;
type WikiConfig = AppConfig & { AI: AiBinding | undefined };

function isLocalDevelopmentOrigin(value: string): boolean {
  const { hostname, protocol } = new URL(value);
  return (
    loopbackHosts.has(hostname) || (protocol === "https:" && /^[a-z0-9-]+\.local$/u.test(hostname))
  );
}

function requireSecureOrigin(value: string): void {
  const { hostname, protocol } = new URL(value);
  if (!loopbackHosts.has(hostname) && protocol !== "https:") {
    throw new Error("HTTPS is required outside localhost");
  }
}

function readEnvironment(input: unknown): Environment {
  const scalars = parse(scalarSchema, input);
  requireSecureOrigin(scalars.APP_ORIGIN);
  const local = isLocalDevelopmentOrigin(scalars.APP_ORIGIN);
  if (
    scalars.MAILPIT_URL !== undefined &&
    (!local || !loopbackHosts.has(new URL(scalars.MAILPIT_URL).hostname))
  ) {
    throw new Error("Mailpit is restricted to local development");
  }
  return { ...scalars, local };
}

function readConfig(input: unknown): AppConfig {
  const scalars = readEnvironment(input);
  const bindings = parse(bindingSchema, input);
  if (scalars.MAILPIT_URL === undefined && !bindings.EMAIL) {
    throw new Error("An email delivery binding is required");
  }
  return { ...scalars, ...bindings };
}

async function sendThroughMailpit(mailpitUrl: string, message: EmailMessage): Promise<void> {
  const response = await fetch(`${mailpitUrl}/api/v1/send`, {
    body: JSON.stringify({
      From: { Email: message.from },
      Subject: message.subject,
      Text: message.text,
      To: [{ Email: message.to }],
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(mailpitTimeoutMilliseconds),
  });
  if (!response.ok) {
    throw new Error(`Email delivery failed (${response.status})`);
  }
}

async function sendVerificationEmail(
  config: Readonly<Pick<AppConfig, "APP_ORIGIN" | "EMAIL_FROM" | "MAILPIT_URL" | "EMAIL">>,
  message: Readonly<{ email: string; url: string }>,
): Promise<void> {
  if (new URL(message.url).origin !== config.APP_ORIGIN) {
    throw new Error("Email link origin mismatch");
  }
  const verification: EmailMessage = {
    from: config.EMAIL_FROM,
    subject: "メールアドレスの確認",
    text: `次のリンクでメールアドレスを確認してください。\n${message.url}`,
    to: message.email,
  };
  if (config.MAILPIT_URL !== undefined) {
    await sendThroughMailpit(config.MAILPIT_URL, verification);
    return;
  }
  if (!config.EMAIL) {
    throw new Error("Email delivery binding is missing");
  }
  await config.EMAIL.send(verification);
}

function readWikiConfig(input: unknown): WikiConfig {
  const { AI } = parse(wikiSchema, input);
  return { ...readConfig(input), AI };
}

export {
  isLocalDevelopmentOrigin,
  readConfig,
  readEnvironment,
  readWikiConfig,
  sendVerificationEmail,
};
export type { AppConfig, EmailBinding, EmailMessage };
