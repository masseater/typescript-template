import { applications, roles } from "@repo/config";
import { Effect, Option, Schema, SchemaGetter } from "effect";

const maximumTokenLength = 4096;
const maximumKeywordLength = 100;
const secondPage = 2;
const maximumContactNameLength = 100;
const maximumContactMessageLength = 4000;

const Role = Schema.Literals(roles);

const ErrorBody = Schema.Struct({ error: Schema.String });

const SessionView = Schema.Struct({
  strong: Schema.Boolean,
  user: Schema.Struct({
    email: Schema.String,
    id: Schema.String,
    name: Schema.String,
    role: Role,
    twoFactorEnabled: Schema.Boolean,
  }),
});

const EmailVerificationRequest = Schema.Struct({
  token: Schema.String.check(Schema.isLengthBetween(1, maximumTokenLength)),
});

const EmailVerified = Schema.Struct({ verified: Schema.Literal(true) });

const UserKeyword = Schema.Trim.check(Schema.isLengthBetween(1, maximumKeywordLength));
const JsonScalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]);
const ScalarText = JsonScalar.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform<string, string | number | boolean | null>(String),
    encode: SchemaGetter.transform((text: string) => text),
  }),
);
const SearchKeyword = ScalarText.pipe(Schema.decodeTo(UserKeyword));

function laterPage(maximum: number): Schema.Codec<number, number | string> {
  return Schema.Union([Schema.Number, Schema.NumberFromString]).check(
    Schema.isInt(),
    Schema.isBetween({ maximum, minimum: secondPage }),
  );
}

function absentSearchKey(): Effect.Effect<Option.Option<never>> {
  return Effect.succeed(Option.none());
}

const HealthView = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String,
  service: Schema.Literals(applications),
});

const ContactSubmission = Schema.Struct({
  email: Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u)),
  message: Schema.Trim.check(Schema.isLengthBetween(1, maximumContactMessageLength)),
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumContactNameLength)),
});

const ContactAccepted = Schema.Struct({ ok: Schema.Literal(true) });

export {
  ContactAccepted,
  ContactSubmission,
  EmailVerificationRequest,
  EmailVerified,
  ErrorBody,
  HealthView,
  Role,
  SearchKeyword,
  SessionView,
  absentSearchKey,
  laterPage,
  maximumContactMessageLength,
  maximumContactNameLength,
  maximumKeywordLength,
};
