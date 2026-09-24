import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { noTestOnlyEnvironmentKey } from "./no-test-only-environment-key--use-real-dependencies-and-http-doubles.ts";

describe("dont-review-it/no-test-only-environment-key--use-real-dependencies-and-http-doubles", () => {
  testLintRule(noTestOnlyEnvironmentKey, {
    valid: [
      {
        name: "a key the production path needs as well passes",
        documented: true,
        code: "const Environment = Schema.Struct({ STRIPE_SECRET_KEY: Schema.Redacted(Schema.String) });",
      },
      {
        name: "a key that only contains the word in the middle is left alone",
        code: "export const path = process.env.LATEST_MOCKUP_PATH;",
      },
      {
        name: "a test constant that is not an environment key is left alone",
        code: 'const TEST_USER = "user";',
      },
    ],
    invalid: [
      {
        name: "a mock switch read from the process environment is reported",
        documented: true,
        code: "export const payments = process.env.MOCK_PAYMENTS === 'true' ? fake : stripe;",
        errors: [{ messageId: "testOnlyKey" }],
      },
      {
        name: "a skip switch declared in the environment schema is reported",
        code: "const Environment = Schema.Struct({ SKIP_EMAIL: Schema.optionalKey(Schema.String) });",
        errors: [{ messageId: "testOnlyKey" }],
      },
      {
        name: "a test-only switch read from the Worker env is reported",
        code: 'import { env } from "cloudflare:workers";\nexport const payments = env.MOCK_PAYMENTS;',
        errors: [{ messageId: "testOnlyKey" }],
      },
      {
        name: "a fake switch read through Config is reported",
        code: 'const fake = Config.Boolean("FAKE_CLOCK");',
        errors: [{ messageId: "testOnlyKey" }],
      },
    ],
  });
});
