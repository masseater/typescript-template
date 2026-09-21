import { Effect, Predicate, Schema } from "effect";

import { loopbackHosts, mailpitSendPath } from "./applications.ts";
import { ConfigurationInvalid } from "./configuration-invalid.ts";

import type { Ai, D1Database, Flagship, SendEmail } from "@cloudflare/workers-types";

type AssetFetcher = {
  readonly fetch: (request: Request) => Promise<Response>;
};

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
const HttpsOrigin = Origin.check(
  Schema.makeFilter(
    (candidate: string) => new URL(candidate).protocol === "https:" || "HTTPS is required",
  ),
);
const Release = Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/u));
const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));
const localRelease = Effect.succeed("local");
const withRelease = Release.pipe(Schema.withDecodingDefaultKey(localRelease));
const AuthSecret = Schema.String.check(Schema.isMinLength(minimumAuthSecretLength));
const NonEmpty = Schema.String.check(Schema.isMinLength(1));
const appEnvKey = {
  appOrigin: "APP_ORIGIN",
  appRelease: "APP_RELEASE",
  authSecret: "AUTH_SECRET",
  emailFrom: "EMAIL_FROM",
  flagshipAccountId: "FLAGSHIP_ACCOUNT_ID",
  flagshipApiToken: "FLAGSHIP_API_TOKEN",
  flagshipAppId: "FLAGSHIP_APP_ID",
  mailpitUrl: "MAILPIT_URL",
  opsEmail: "OPS_EMAIL",
  otlpAuthorization: "OTLP_AUTHORIZATION",
  otlpEnabled: "OTLP_ENABLED",
  otlpEndpoint: "OTLP_ENDPOINT",
} as const;

const distinctOrigins = (origins: readonly string[]): boolean =>
  new Set(origins).size === origins.length;

const bindingWith = <Binding>(
  bindingName: string,
  methods: readonly string[],
): Schema.declare<Binding, Binding> =>
  Schema.declare(
    (candidate: unknown): candidate is Binding =>
      Predicate.isObject(candidate) &&
      methods.every((method) => typeof Reflect.get(candidate, method) === "function"),
    { expected: bindingName },
  );

const Scalars = Schema.Struct({
  [appEnvKey.appOrigin]: Origin,
  [appEnvKey.appRelease]: withRelease,
  [appEnvKey.authSecret]: AuthSecret,
  [appEnvKey.emailFrom]: Email,
  [appEnvKey.flagshipAccountId]: Schema.optionalKey(NonEmpty),
  [appEnvKey.flagshipApiToken]: Schema.optionalKey(NonEmpty),
  [appEnvKey.flagshipAppId]: Schema.optionalKey(NonEmpty),
  [appEnvKey.mailpitUrl]: Schema.optionalKey(Origin),
  [appEnvKey.opsEmail]: Email,
  [appEnvKey.otlpAuthorization]: Schema.optionalKey(NonEmpty),
  [appEnvKey.otlpEnabled]: Schema.optionalKey(Schema.Literals(["false", "true"])),
  [appEnvKey.otlpEndpoint]: Schema.optionalKey(AbsoluteUrl),
});

const EmailBinding = bindingWith<SendEmail>("SendEmail", ["send"]);
const FlagshipBinding = bindingWith<Flagship>("Flagship", [
  "getBooleanValue",
  "getStringValue",
  "getNumberValue",
  "getObjectValue",
]);

const Bindings = Schema.Struct({
  ASSETS: bindingWith<AssetFetcher>("Fetcher", ["fetch"]),
  DB: bindingWith<D1Database>("D1Database", ["prepare", "batch"]),
  EMAIL: Schema.optionalKey(EmailBinding),
  FLAGS: Schema.optionalKey(FlagshipBinding),
});

const AiBindings = Schema.Struct({
  AI: Schema.optionalKey(bindingWith<Ai>("Ai", ["run"])),
});

const isLocalLanHostname = (hostname: string): boolean =>
  /^[a-z0-9-]+\.local$/u.test(hostname) || /^[a-z0-9-]+\.local\.example\.test$/u.test(hostname);

const isLocalDevelopmentOrigin = (candidate: string): boolean => {
  const parsed = URL.parse(candidate);
  return (
    parsed !== null &&
    (loopbackHosts.includes(parsed.hostname) ||
      (parsed.protocol === "https:" && isLocalLanHostname(parsed.hostname)))
  );
};

const invalid = (reason: string): ConfigurationInvalid => new ConfigurationInvalid({ reason });

const decode = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  input: unknown,
): Effect.Effect<Decoded["Type"], ConfigurationInvalid> =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((issue) => invalid(issue.message)),
  );

const requireSecureOrigin = (origin: string): Effect.Effect<void, ConfigurationInvalid> => {
  const parsed = new URL(origin);
  return parsed.protocol === "https:" || loopbackHosts.includes(parsed.hostname)
    ? Effect.void
    : Effect.fail(invalid("HTTPS is required outside localhost"));
};

const readEnvironment = Effect.fn("readEnvironment")(function* readEnvironment(input: unknown) {
  const scalars = yield* decode(Scalars, input);
  yield* requireSecureOrigin(scalars.APP_ORIGIN);
  const local = isLocalDevelopmentOrigin(scalars.APP_ORIGIN);
  if (
    scalars.MAILPIT_URL !== undefined &&
    (!local || !loopbackHosts.includes(new URL(scalars.MAILPIT_URL).hostname))
  ) {
    return yield* invalid("Mailpit is restricted to local development");
  }
  if (scalars.OTLP_ENDPOINT === undefined) {
    if (scalars.OTLP_ENABLED !== undefined) {
      return yield* invalid("OTLP_ENABLED needs OTLP_ENDPOINT");
    }
  } else {
    yield* requireSecureOrigin(scalars.OTLP_ENDPOINT);
  }
  return {
    ...scalars,
    local,
    ...(scalars.MAILPIT_URL === undefined
      ? {}
      : { MAILPIT_SEND_URL: `${scalars.MAILPIT_URL}${mailpitSendPath}` }),
  };
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

export {
  AuthSecret,
  Email,
  HttpsOrigin,
  appEnvKey,
  bindingWith,
  decode,
  distinctOrigins,
  isLocalDevelopmentOrigin,
  minimumAuthSecretLength,
  readAi,
  readConfig,
  readEnvironment,
};
export type { AppConfig, AssetFetcher };
