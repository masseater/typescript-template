import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noPlainSecretEnvironmentKey } from "./no-plain-secret-environment-key--wrap-it-in-redacted.ts";

describe("dont-review-it/no-plain-secret-environment-key--wrap-it-in-redacted", () => {
  testLintRule(noPlainSecretEnvironmentKey, {
    valid: [
      {
        name: "a secret declared as Redacted in the schema passes",
        documented: true,
        code: "const Environment = Schema.Struct({ AUTH_SECRET: Schema.Redacted(Schema.String) });",
      },
      {
        name: "an optional secret wrapped in Redacted passes",
        code: "const Environment = Schema.Struct({ OTLP_AUTHORIZATION: Schema.optionalKey(Schema.Redacted(Schema.String)) });",
      },
      {
        name: "a secret schema declared in the same file and refined passes",
        code: "const Secret = Schema.Redacted(Schema.String);\nconst Environment = Schema.Struct({ API_TOKEN: Secret.check(minimum) });",
      },
      {
        name: "a secret read with Config.Redacted passes",
        documented: true,
        code: 'const token = Config.Redacted("GITHUB_TOKEN");',
      },
      {
        name: "a secret read through a schema and mapped into Redacted passes",
        code: "const secret = Config.schema(AuthSecret, deploymentKey.authSecret).pipe(Config.map(Redacted.make));",
      },
      {
        name: "a secret read through a Redacted schema passes",
        code: 'const secret = Config.schema(Schema.Redacted(Schema.String), "AUTH_SECRET");',
      },
      {
        name: "a key that names no secret is left alone",
        code: "const Environment = Schema.Struct({ APP_ORIGIN: Schema.String });",
      },
      {
        name: "a field of a data schema is not an environment key",
        code: "const Session = Schema.Struct({ token: Schema.String });",
      },
      {
        name: "a key whose spelling cannot be resolved is not judged",
        code: "const Environment = Schema.Struct({ [bindingName]: Schema.String });",
      },
      {
        name: "a Config call that reads no key is not judged",
        code: "const settings = Config.all({ token });",
      },
    ],
    invalid: [
      {
        name: "a secret declared as a plain string in the schema is reported",
        documented: true,
        code: "const Environment = Schema.Struct({ AUTH_SECRET: Schema.String });",
        errors: [{ messageId: "plainSecret" }],
      },
      {
        name: "a secret key resolved through a key table in the same file is reported",
        code: 'const key = { authSecret: "AUTH_SECRET" } as const;\nconst Environment = Schema.Struct({ [key.authSecret]: Schema.optionalKey(Schema.String) });',
        errors: [{ messageId: "plainSecret" }],
      },
      {
        name: "a secret key taken from an imported key table is judged by its property name",
        code: "const Environment = Schema.Struct({ [deploymentKey.stripeApiKey]: Schema.String });",
        errors: [{ messageId: "plainSecret" }],
      },
      {
        name: "a secret read with Config.String is reported",
        documented: true,
        code: 'const token = Config.String("GITHUB_TOKEN");',
        errors: [{ messageId: "plainSecret" }],
      },
      {
        name: "a secret read through a plain schema is reported",
        code: 'const password = Config.schema(Schema.String, "DATABASE_PASSWORD");',
        errors: [{ messageId: "plainSecret" }],
      },
      {
        name: "a secret schema imported from elsewhere cannot be shown to be Redacted",
        code: "const Environment = Schema.Struct({ STRIPE_WEBHOOK_SECRET: StripeWebhookSecret });",
        errors: [{ messageId: "plainSecret" }],
      },
      {
        name: "a local schema that refers to itself is not Redacted",
        code: "const Loop = Loop;\nconst Environment = Schema.Struct({ API_KEY: Loop });",
        errors: [{ messageId: "plainSecret" }],
      },
    ],
  });
});
