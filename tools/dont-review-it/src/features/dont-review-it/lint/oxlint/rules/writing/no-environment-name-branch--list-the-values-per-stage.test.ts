import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { noEnvironmentNameBranch } from "./no-environment-name-branch--list-the-values-per-stage.ts";

describe("dont-review-it/no-environment-name-branch--list-the-values-per-stage", () => {
  testLintRule(noEnvironmentNameBranch, {
    valid: [
      {
        name: "reading the value that differs per stage passes",
        documented: true,
        code: "const Environment = Schema.Struct({ APP_ORIGIN: Schema.String });",
      },
      {
        name: "a key that only starts like an environment name is left alone",
        code: "export const path = process.env.ENVELOPE_PATH;",
      },
      {
        name: "a member called MODE on something other than the environment is left alone",
        code: "export const backup = CHALLENGE.MODE;",
      },
    ],
    invalid: [
      {
        name: "branching on NODE_ENV is reported",
        documented: true,
        code: "export const origin = process.env.NODE_ENV === 'production' ? live : local;",
        errors: [{ messageId: "environmentName" }],
      },
      {
        name: "an environment name declared in the schema is reported",
        code: "const Environment = Schema.Struct({ APP_ENV: Schema.Literals(['production', 'staging']) });",
        errors: [{ messageId: "environmentName" }],
      },
      {
        name: "the Vite mode read from import.meta.env is reported",
        code: "if (import.meta.env.MODE === 'staging') { enableBanner(); }",
        errors: [{ messageId: "environmentName" }],
      },
      {
        name: "a stage read through Config is reported",
        code: 'const stage = Config.String("STAGE");',
        errors: [{ messageId: "environmentName" }],
      },
    ],
  });
});
