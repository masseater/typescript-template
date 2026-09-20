import { applications } from "@repo/config";
import { roles } from "@repo/config/identity";
import { Schema } from "effect";

type Decodable = Schema.Top & { readonly DecodingServices: never };

const maximumTokenLength = 4096;

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

const HealthView = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String,
  service: Schema.Literals(applications),
});

export { EmailVerificationRequest, EmailVerified, ErrorBody, HealthView, SessionView };
export type { Decodable };
