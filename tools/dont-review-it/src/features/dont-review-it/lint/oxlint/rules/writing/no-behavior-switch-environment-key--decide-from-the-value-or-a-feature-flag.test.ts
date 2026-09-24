import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noBehaviorSwitchEnvironmentKey } from "./no-behavior-switch-environment-key--decide-from-the-value-or-a-feature-flag.ts";

describe("dont-review-it/no-behavior-switch-environment-key--decide-from-the-value-or-a-feature-flag", () => {
  testLintRule(noBehaviorSwitchEnvironmentKey, {
    valid: [
      {
        name: "deciding from the presence of the value itself passes",
        documented: true,
        code: "const Environment = Schema.Struct({ OTLP_ENDPOINT: Schema.optionalKey(Schema.String) });",
      },
      {
        name: "a constant spelled like a switch that is not an environment key is left alone",
        code: 'const CHALLENGE_MODE = { backup: "backup" };\ndeny("TRUSTED_DEVICE_DISABLED");',
      },
      {
        name: "a key that merely contains the word elsewhere is left alone",
        code: "export const model = process.env.MODEL_NAME;",
      },
    ],
    invalid: [
      {
        name: "an enabled switch declared in the environment schema is reported",
        documented: true,
        code: "const Environment = Schema.Struct({ OTLP_ENABLED: Schema.optionalKey(Schema.String) });",
        errors: [{ messageId: "behaviorSwitch" }],
      },
      {
        name: "a disabled switch read from the process environment is reported",
        code: "export const off = process.env.TELEMETRY_DISABLED === '1';",
        errors: [{ messageId: "behaviorSwitch" }],
      },
      {
        name: "a mode switch read through Config is reported",
        code: 'const mode = Config.String("CHECKOUT_MODE");',
        errors: [{ messageId: "behaviorSwitch" }],
      },
      {
        name: "DEBUG read from the Worker env is reported",
        code: 'import { env } from "cloudflare:workers";\nexport const verbose = env.DEBUG;',
        errors: [{ messageId: "behaviorSwitch" }],
      },
    ],
  });
});
