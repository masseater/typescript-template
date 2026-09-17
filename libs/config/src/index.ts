import type { Ai, D1Database, SendEmail } from "@cloudflare/workers-types";
import { Effect, Schema } from "effect";

export type AssetFetcher = { fetch(request: Request): Promise<Response> };

export class ConfigurationInvalid extends Schema.TaggedError<ConfigurationInvalid>()(
  "ConfigurationInvalid",
  { reason: Schema.String },
) {}

export class EmailDeliveryFailed extends Schema.TaggedError<EmailDeliveryFailed>()(
  "EmailDeliveryFailed",
  { reason: Schema.Literals(["origin_mismatch", "rejected", "unreachable"]) },
) {}

const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];

const AbsoluteUrl = Schema.String.check(
  Schema.makeFilter((value: string) => URL.canParse(value) || "Expected an absolute URL"),
);
const Origin = AbsoluteUrl.check(
  Schema.makeFilter(
    (value: string) => URL.parse(value)?.origin === value || "An origin without a path is required",
  ),
);
const Release = Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/));
const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
const withRelease = Release.pipe(Schema.withDecodingDefaultKey(Effect.succeed("local")));

const bindingWith = <T>(name: string, methods: readonly string[]) =>
  Schema.declare(
    (value: unknown): value is T =>
      typeof value === "object" &&
      value !== null &&
      methods.every((method) => typeof Reflect.get(value, method) === "function"),
    { expected: name },
  );

const Scalars = Schema.Struct({
  APP_ORIGIN: Origin,
  AUTH_SECRET: Schema.String.check(Schema.isMinLength(32)),
  APP_RELEASE: withRelease,
  EMAIL_FROM: Email,
  MAILPIT_URL: Schema.optionalKey(Origin),
});

const Bindings = Schema.Struct({
  DB: bindingWith<D1Database>("D1Database", ["prepare", "batch"]),
  ASSETS: bindingWith<AssetFetcher>("Fetcher", ["fetch"]),
  EMAIL: Schema.optionalKey(bindingWith<SendEmail>("SendEmail", ["send"])),
});

const WikiEnvironment = Schema.Struct({
  APP_ORIGIN: Origin,
  APP_RELEASE: withRelease,
  ASSETS: bindingWith<AssetFetcher>("Fetcher", ["fetch"]),
  AI: Schema.optionalKey(bindingWith<Ai>("Ai", ["run"])),
});

export function isLocalDevelopmentOrigin(value: string): boolean {
  const url = URL.parse(value);
  return (
    url !== null &&
    (loopbackHosts.includes(url.hostname) ||
      (url.protocol === "https:" && /^[a-z0-9-]+\.local$/.test(url.hostname)))
  );
}

const invalid = (reason: string) => new ConfigurationInvalid({ reason });

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(
  schema: S,
  input: unknown,
) =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((error) => invalid(error.message)),
  );

const requireSecureOrigin = (origin: string) =>
  new URL(origin).protocol === "https:" || loopbackHosts.includes(new URL(origin).hostname)
    ? Effect.void
    : Effect.fail(invalid("HTTPS is required outside localhost"));

export const readEnvironment = Effect.fn("readEnvironment")(function* (input: unknown) {
  const scalars = yield* decode(Scalars, input);
  yield* requireSecureOrigin(scalars.APP_ORIGIN);
  const local = isLocalDevelopmentOrigin(scalars.APP_ORIGIN);
  if (
    scalars.MAILPIT_URL !== undefined &&
    (!local || !loopbackHosts.includes(new URL(scalars.MAILPIT_URL).hostname))
  )
    return yield* invalid("Mailpit is restricted to local development");
  return { ...scalars, local };
});

export const readConfig = Effect.fn("readConfig")(function* (input: unknown) {
  const scalars = yield* readEnvironment(input);
  const bindings = yield* decode(Bindings, input);
  if (scalars.MAILPIT_URL === undefined && bindings.EMAIL === undefined)
    return yield* invalid("An email delivery binding is required");
  return { ...scalars, ...bindings };
});

export type AppConfig = Effect.Success<ReturnType<typeof readConfig>>;

export const readWikiConfig = Effect.fn("readWikiConfig")(function* (input: unknown) {
  const config = yield* decode(WikiEnvironment, input);
  yield* requireSecureOrigin(config.APP_ORIGIN);
  return config;
});

export type WikiConfig = Effect.Success<ReturnType<typeof readWikiConfig>>;

export const sendVerificationEmail = Effect.fn("sendVerificationEmail")(function* (
  config: Pick<AppConfig, "APP_ORIGIN" | "EMAIL_FROM" | "MAILPIT_URL" | "EMAIL">,
  message: { readonly email: string; readonly url: string },
) {
  if (URL.parse(message.url)?.origin !== config.APP_ORIGIN)
    return yield* new EmailDeliveryFailed({ reason: "origin_mismatch" });
  const email = {
    from: config.EMAIL_FROM,
    to: message.email,
    subject: "メールアドレスの確認",
    text: `次のリンクでメールアドレスを確認してください。\n${message.url}`,
  };
  const mailpit = config.MAILPIT_URL;
  if (mailpit !== undefined) {
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(`${mailpit}/api/v1/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            From: { Email: email.from },
            To: [{ Email: email.to }],
            Subject: email.subject,
            Text: email.text,
          }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
          redirect: "manual",
        }),
      catch: () => new EmailDeliveryFailed({ reason: "unreachable" }),
    });
    if (!response.ok) return yield* new EmailDeliveryFailed({ reason: "rejected" });
    return;
  }
  const binding = config.EMAIL;
  if (binding === undefined) return yield* new EmailDeliveryFailed({ reason: "unreachable" });
  yield* Effect.tryPromise({
    try: () => binding.send(email),
    catch: () => new EmailDeliveryFailed({ reason: "rejected" }),
  });
});
