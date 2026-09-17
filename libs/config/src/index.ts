import {
  check,
  custom,
  email,
  minLength,
  object,
  optional,
  parse,
  pipe,
  record,
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
  readonly fetch: (request: Request) => Promise<Response>;
}
interface AiBinding {
  readonly run: (model: string, inputs: { readonly text: readonly string[] }) => Promise<unknown>;
}
interface SentryConfig {
  readonly dsn: string;
  readonly environment: string;
  readonly release: string;
}

const minimumAuthSecretLength = 32;
const mailpitTimeoutMilliseconds = 10_000;

const absoluteUrl = pipe(string(), url());
const sentrySchemas = {
  dsn: absoluteUrl,
  environment: pipe(string(), regex(/^[a-z0-9.-]{1,64}$/u)),
  release: pipe(string(), regex(/^[a-zA-Z0-9._-]{1,128}$/u)),
};
const origin = pipe(
  absoluteUrl,
  check((value) => new URL(value).origin === value, "An origin without a path is required"),
);
const sentryFields = {
  SENTRY_DSN: optional(sentrySchemas.dsn),
  SENTRY_ENVIRONMENT: optional(sentrySchemas.environment),
  SENTRY_RELEASE: optional(sentrySchemas.release),
};
const scalarSchema = object({
  APP_ORIGIN: origin,
  AUTH_SECRET: pipe(string(), minLength(minimumAuthSecretLength)),
  EMAIL_FROM: pipe(string(), email()),
  MAILPIT_URL: optional(origin),
  OTEL_EXPORTER_OTLP_ENDPOINT: absoluteUrl,
  OTEL_EXPORTER_OTLP_HEADERS: optional(string()),
  ...sentryFields,
});
const otelHeadersSchema = record(string(), string());

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
  APP_ORIGIN: origin,
  ASSETS: assetBindingSchema,
  OTEL_EXPORTER_OTLP_ENDPOINT: absoluteUrl,
  OTEL_EXPORTER_OTLP_HEADERS: optional(string()),
  ...sentryFields,
});

type SentryInput = Readonly<
  Pick<InferOutput<typeof scalarSchema>, "SENTRY_DSN" | "SENTRY_ENVIRONMENT" | "SENTRY_RELEASE">
>;
type Environment = InferOutput<typeof scalarSchema> & {
  local: boolean;
  otelHeaders: Record<string, string>;
  sentry: SentryConfig | undefined;
};
type AppConfig = Environment & InferOutput<typeof bindingSchema>;
interface WikiConfig {
  AI: AiBinding | undefined;
  APP_ORIGIN: string;
  ASSETS: AssetBinding;
  OTEL_EXPORTER_OTLP_ENDPOINT: string;
  otelHeaders: Record<string, string>;
  sentry: SentryConfig | undefined;
}

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

function parseSentry(input: SentryInput): SentryConfig | undefined {
  if (input.SENTRY_DSN === undefined) {
    return undefined;
  }
  return {
    dsn: input.SENTRY_DSN,
    environment: parse(sentrySchemas.environment, input.SENTRY_ENVIRONMENT),
    release: parse(sentrySchemas.release, input.SENTRY_RELEASE),
  };
}

function parseOtelHeaders(value: string | undefined): Record<string, string> {
  if (value === undefined) {
    return {};
  }
  return parse(otelHeadersSchema, JSON.parse(value) as unknown);
}

function readEnvironment(input: unknown): Environment {
  const scalars = parse(scalarSchema, input);
  const sentry = parseSentry(scalars);
  requireSecureOrigin(scalars.APP_ORIGIN);
  const local = isLocalDevelopmentOrigin(scalars.APP_ORIGIN);
  if (
    scalars.MAILPIT_URL !== undefined &&
    (!local || !loopbackHosts.has(new URL(scalars.MAILPIT_URL).hostname))
  ) {
    throw new Error("Mailpit is restricted to local development");
  }
  const otelHeaders = parseOtelHeaders(scalars.OTEL_EXPORTER_OTLP_HEADERS);
  return { ...scalars, local, otelHeaders, sentry };
}

function readConfig(input: unknown): AppConfig {
  const scalars = readEnvironment(input);
  const bindings = parse(bindingSchema, input);
  if (scalars.MAILPIT_URL === undefined && !bindings.EMAIL) {
    throw new Error("An email delivery binding is required");
  }
  return { ...scalars, ...bindings };
}

async function sendThroughMailpit(
  mailpitUrl: string,
  message: EmailMessage,
  traceparent: string | undefined,
): Promise<void> {
  const response = await fetch(`${mailpitUrl}/api/v1/send`, {
    body: JSON.stringify({
      From: { Email: message.from },
      Subject: message.subject,
      Text: message.text,
      To: [{ Email: message.to }],
    }),
    headers: {
      "content-type": "application/json",
      ...(traceparent === undefined || traceparent === "" ? {} : { traceparent }),
    },
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
  traceparent?: string,
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
    await sendThroughMailpit(config.MAILPIT_URL, verification, traceparent);
    return;
  }
  if (!config.EMAIL) {
    throw new Error("Email delivery binding is missing");
  }
  await config.EMAIL.send(verification);
}

function readWikiConfig(input: unknown): WikiConfig {
  const config = parse(wikiSchema, input);
  requireSecureOrigin(config.APP_ORIGIN);
  return {
    AI: config.AI,
    APP_ORIGIN: config.APP_ORIGIN,
    ASSETS: config.ASSETS,
    OTEL_EXPORTER_OTLP_ENDPOINT: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelHeaders: parseOtelHeaders(config.OTEL_EXPORTER_OTLP_HEADERS),
    sentry: parseSentry(config),
  };
}

export {
  isLocalDevelopmentOrigin,
  readConfig,
  readEnvironment,
  readWikiConfig,
  sendVerificationEmail,
  sentrySchemas,
};
export type { AppConfig, EmailBinding, EmailMessage };
