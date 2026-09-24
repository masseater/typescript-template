---
description: "Disallow reading or declaring an environment key that names the environment itself (`NODE_ENV`, `APP_ENV`, `STAGE`, `import.meta.env.MODE`), so the differences between environments live in one table of values per stage instead of in comparisons spread through the code"
---

# no-environment-name-branch--list-the-values-per-stage

<!-- BEGIN GENERATED rule-header -->

Disallow reading or declaring an environment key that names the environment itself (`NODE_ENV`, `APP_ENV`, `STAGE`, `import.meta.env.MODE`), so the differences between environments live in one table of values per stage instead of in comparisons spread through the code

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-environment-name-branch--list-the-values-per-stage.ts`](../../src/features/dont-review-it/lint/oxlint/rules/writing/no-environment-name-branch--list-the-values-per-stage.ts)

<!-- END GENERATED rule-header -->

## Violation

An environment key that names the environment itself: a key ending in `_ENV`, `_ENVIRONMENT` or `_STAGE`, one named `ENV`, `ENVIRONMENT` or `STAGE`, and `MODE`, `DEV` and `PROD`. The key is read where it is declared in an environment schema, passed to an Effect `Config` reader, or read from `process.env`, `import.meta.env` or a Worker's `env`. Every read is reported, since reading the name of the environment only serves to branch on it.

## Fix

Write what differs between environments as one table with a row per stage, select the row where the process is configured, and hand the selected values down, so no other code compares environment names.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// branching on NODE_ENV is reported
export const origin = process.env.NODE_ENV === 'production' ? live : local;
```

Code this rule accepts.

```ts
// reading the value that differs per stage passes
const Environment = Schema.Struct({ APP_ORIGIN: Schema.String });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Reading the name once and passing a boolean such as `isProduction` down. The branch on the environment name moves, it does not go away
- Inferring the environment from another value, such as whether an origin is `localhost`, to branch the same way

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `environmentName` | An environment key that names the environment, such as \`{{name}}\`, must not be read or declared. Write what differs between environments as one table of values per stage, select the row where the process is configured, and hand the selected values down. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
