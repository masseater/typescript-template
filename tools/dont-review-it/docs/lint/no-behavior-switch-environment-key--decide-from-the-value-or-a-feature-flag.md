---
description: "Disallow environment keys named as switches (`*_ENABLED`, `*_DISABLED`, `*_MODE`, `DEBUG`), so behaviour follows from whether the real value is present or from a feature flag instead of from a second key that can disagree with it"
---

# no-behavior-switch-environment-key--decide-from-the-value-or-a-feature-flag

<!-- BEGIN GENERATED rule-header -->

Disallow environment keys named as switches (`*_ENABLED`, `*_DISABLED`, `*_MODE`, `DEBUG`), so behaviour follows from whether the real value is present or from a feature flag instead of from a second key that can disagree with it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-behavior-switch-environment-key--decide-from-the-value-or-a-feature-flag.ts`](../../src/features/dont-review-it/lint/oxlint/rules/writing/no-behavior-switch-environment-key--decide-from-the-value-or-a-feature-flag.ts)

<!-- END GENERATED rule-header -->

## Violation

An environment key ending in `_ENABLED`, `_DISABLED` or `_MODE`, or named `DEBUG`, `DEBUG_*` or `VERBOSE`. The key is read where it is declared in an environment schema, passed to an Effect `Config` reader, or read from `process.env`, `import.meta.env` or a Worker's `env`. A constant spelled like a switch that is not an environment key is not read.

## Fix

Decide from whether the value the behaviour needs is present, such as sending telemetry when an endpoint is configured. When the behaviour has to be switched at run time, use a feature flag. When it never changes between environments, write the choice in the code.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an enabled switch declared in the environment schema is reported
const Environment = Schema.Struct({ OTLP_ENABLED: Schema.optionalKey(Schema.String) });
```

Code this rule accepts.

```ts
// deciding from the presence of the value itself passes
const Environment = Schema.Struct({ OTLP_ENDPOINT: Schema.optionalKey(Schema.String) });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the switch so it no longer ends in one of the watched words. It is still a second key that can disagree with the value it switches
- Encoding the switch into the value of another key, such as an empty endpoint that means off

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `behaviorSwitch` | An environment key such as \`{{name}}\` must not switch behaviour. Decide from whether the value the behaviour needs is present, move the switch to a feature flag, or write the fixed choice in the code. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
