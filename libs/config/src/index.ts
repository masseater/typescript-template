import type { Ai, D1Database, SendEmail } from "@cloudflare/workers-types";
import { Effect, Schema } from "effect";

import { loopbackHosts } from "./applications.ts";
import { ConfigurationInvalid } from "./configuration-invalid.ts";

interface AssetFetcher {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request) => Promise<Response>;
}

const minimumAuthSecretLength = 32;

const AbsoluteUrl = Schema.String.check(
  Schema.makeFilter((value: string) => URL.canParse(value) || "Expected an absolute URL"),
);
const Origin = AbsoluteUrl.check(
  Schema.makeFilter(
    (value: string) => URL.parse(value)?.origin === value || "An origin without a path is required",
  ),
);
const Release = Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/u));
const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));
const localRelease = Effect.succeed("local");
const withRelease = Release.pipe(Schema.withDecodingDefaultKey(localRelease));
const AuthSecret = Schema.String.check(Schema.isMinLength(minimumAuthSecretLength));

function bindingWith<Binding>(
  name: string,
  methods: readonly string[],
): Schema.declare<Binding, Binding> {
  return Schema.declare(
    (value: unknown): value is Binding =>
      typeof value === "object" &&
      value !== null &&
      methods.every((method) => typeof Reflect.get(value, method) === "function"),
    { expected: name },
  );
}

const Scalars = Schema.Struct({
  APP_ORIGIN: Origin,
  APP_RELEASE: withRelease,
  AUTH_SECRET: AuthSecret,
  EMAIL_FROM: Email,
  MAILPIT_URL: Schema.optionalKey(Origin),
});

const EmailBinding = bindingWith<SendEmail>("SendEmail", ["send"]);
const Bindings = Schema.Struct({
  ASSETS: bindingWith<AssetFetcher>("Fetcher", ["fetch"]),
  DB: bindingWith<D1Database>("D1Database", ["prepare", "batch"]),
  EMAIL: Schema.optionalKey(EmailBinding),
});

const AiBindings = Schema.Struct({
  AI: Schema.optionalKey(bindingWith<Ai>("Ai", ["run"])),
});

function isLocalDevelopmentOrigin(value: string): boolean {
  const url = URL.parse(value);
  return (
    url !== null &&
    (loopbackHosts.includes(url.hostname) ||
      (url.protocol === "https:" && /^[a-z0-9-]+\.local$/u.test(url.hostname)))
  );
}

function invalid(reason: string): ConfigurationInvalid {
  return new ConfigurationInvalid({ reason });
}

function decode<Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  input: unknown,
): Effect.Effect<Decoded["Type"], ConfigurationInvalid> {
  return Schema.decodeUnknownEffect(schema)(input).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.mapError((issue) => invalid(issue.message)),
  );
}

function requireSecureOrigin(origin: string): Effect.Effect<void, ConfigurationInvalid> {
  const url = new URL(origin);
  return url.protocol === "https:" || loopbackHosts.includes(url.hostname)
    ? Effect.void
    : Effect.fail(invalid("HTTPS is required outside localhost"));
}

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
  return { ...scalars, local };
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

export {
  applicationPorts,
  applications,
  authenticationMethods,
  grants,
  loopbackHosts,
  roles,
  storybookPort,
  strongAuthenticationMethods,
} from "./applications.ts";
export type {
  Application,
  Capability,
  CapabilityOf,
  Role,
  StrongAuthenticationMethod,
} from "./applications.ts";
export { ConfigurationInvalid } from "./configuration-invalid.ts";
export { EmailDeliveryFailed } from "./email-delivery-failed.ts";
export { sendVerificationEmail } from "./email.ts";
export { isLocalDevelopmentOrigin, readAi, readConfig, readEnvironment, readWikiConfig };
export type { AppConfig, AssetFetcher, WikiConfig };
