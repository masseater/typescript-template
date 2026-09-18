import { Effect, Schema } from "effect";

import { loopbackHosts } from "./applications.ts";
import { ConfigurationInvalid } from "./configuration-invalid.ts";

import type { Ai, D1Database, SendEmail } from "@cloudflare/workers-types";

const minimumAuthSecretLength = 32;

const AbsoluteUrl = Schema.String.check(
  Schema.makeFilter((candidate: string) => URL.canParse(candidate) || "Expected an absolute URL"),
);
const Origin = AbsoluteUrl.check(
  Schema.makeFilter(
    (candidate: string) =>
      URL.parse(candidate)?.origin === candidate || "An origin without a path is required",
  ),
);
const Release = Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/u));
const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));
const localRelease = Effect.succeed("local");
const withRelease = Release.pipe(Schema.withDecodingDefaultKey(localRelease));
const AuthSecret = Schema.String.check(Schema.isMinLength(minimumAuthSecretLength));
const NonEmpty = Schema.String.check(Schema.isMinLength(1));

const bindingWith = <Binding>(
  bindingName: string,
  methods: readonly string[],
): Schema.declare<Binding, Binding> => {
  return Schema.declare(
    (candidate: unknown): candidate is Binding =>
      typeof candidate === "object" &&
      candidate !== null &&
      methods.every((method) => typeof Reflect.get(candidate, method) === "function"),
    { expected: bindingName },
  );
};

const Scalars = Schema.Struct({
  APP_ORIGIN: Origin,
  APP_RELEASE: withRelease,
  AUTH_SECRET: AuthSecret,
  EMAIL_FROM: Email,
  MAILPIT_URL: Schema.optionalKey(Origin),
  OTLP_AUTHORIZATION: Schema.optionalKey(NonEmpty),
  OTLP_ENABLED: Schema.optionalKey(Schema.Literals(["false", "true"])),
  OTLP_ENDPOINT: Schema.optionalKey(AbsoluteUrl),
});

type AssetFetcher = {
  readonly fetch: (request: Request) => Promise<Response>;
};

const Bindings = Schema.Struct({
  ASSETS: bindingWith<AssetFetcher>("Fetcher", ["fetch"]),
  DB: bindingWith<D1Database>("D1Database", ["prepare", "batch"]),
  EMAIL: Schema.optionalKey(bindingWith<SendEmail>("SendEmail", ["send"])),
});

const AiBindings = Schema.Struct({
  AI: Schema.optionalKey(bindingWith<Ai>("Ai", ["run"])),
});

const isLocalDevelopmentOrigin = (origin: string): boolean => {
  const url = URL.parse(origin);
  return (
    url !== null &&
    (loopbackHosts.includes(url.hostname) ||
      (url.protocol === "https:" && /^[a-z0-9-]+\.local$/u.test(url.hostname)))
  );
};

const invalid = (reason: string): ConfigurationInvalid => {
  return new ConfigurationInvalid({ reason });
};

const decode = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  input: unknown,
): Effect.Effect<Decoded["Type"], ConfigurationInvalid> => {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((issue) => invalid(issue.message)),
  );
};

const requireSecureOrigin = (origin: string): Effect.Effect<void, ConfigurationInvalid> => {
  const url = new URL(origin);
  return url.protocol === "https:" || loopbackHosts.includes(url.hostname)
    ? Effect.void
    : Effect.fail(invalid("HTTPS is required outside localhost"));
};

const mailpitSendPath = "/api/v1/send";

const readEnvironment = Effect.fn("readEnvironment")(function* readEnvironment(input: unknown) {
  const scalars = yield* decode(Scalars, input);
  yield* requireSecureOrigin(scalars.APP_ORIGIN);
  const local = isLocalDevelopmentOrigin(scalars.APP_ORIGIN);
  if (scalars.OTLP_ENDPOINT === undefined) {
    if (scalars.OTLP_ENABLED !== undefined) {
      return yield* invalid("OTLP_ENABLED needs OTLP_ENDPOINT");
    }
  } else {
    yield* requireSecureOrigin(scalars.OTLP_ENDPOINT);
  }
  if (scalars.MAILPIT_URL === undefined) {
    return { ...scalars, local };
  }
  if (!local || !loopbackHosts.includes(new URL(scalars.MAILPIT_URL).hostname)) {
    return yield* invalid("Mailpit is restricted to local development");
  }
  const MAILPIT_SEND_URL = new URL(mailpitSendPath, scalars.MAILPIT_URL).href;
  return { ...scalars, MAILPIT_SEND_URL, local };
});

const readConfig = Effect.fn("readConfig")(function* readConfig(input: unknown) {
  const scalars = yield* readEnvironment(input);
  const bindings = yield* decode(Bindings, input);
  if (scalars.MAILPIT_URL === undefined && bindings.EMAIL === undefined) {
    return yield* invalid("An email delivery binding is required");
  }
  return { ...scalars, ...bindings };
});

type AppConfig = Effect.Success<ReturnType<typeof readConfig>>;

const readAi = Effect.fn("readAi")(function* readAi(input: unknown) {
  const { AI } = yield* decode(AiBindings, input);
  return AI;
});

const readWikiConfig = Effect.fn("readWikiConfig")(function* readWikiConfig(input: unknown) {
  const config = yield* readConfig(input);
  return { ...config, AI: yield* readAi(input) };
});

type WikiConfig = Effect.Success<ReturnType<typeof readWikiConfig>>;

export { Email, isLocalDevelopmentOrigin, readAi, readConfig, readEnvironment, readWikiConfig };
export type { AppConfig, AssetFetcher, WikiConfig };
