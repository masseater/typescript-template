---
description: "Disallow declaring an environment key whose name marks it as a secret without wrapping its value in `Redacted`, so the value cannot reach a log, an error message or a trace as plain text"
---

# no-plain-secret-environment-key--wrap-it-in-redacted

<!-- BEGIN GENERATED rule-header -->

Disallow declaring an environment key whose name marks it as a secret without wrapping its value in `Redacted`, so the value cannot reach a log, an error message or a trace as plain text

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-plain-secret-environment-key--wrap-it-in-redacted.ts`](../../src/features/dont-review-it/lint/oxlint/rules/writing/no-plain-secret-environment-key--wrap-it-in-redacted.ts)

<!-- END GENERATED rule-header -->

## Violation

An environment key whose name contains `SECRET`, `TOKEN`, `API_KEY`, `AUTHORIZATION`, `PASSWORD`, `PRIVATE_KEY` or `CREDENTIAL(S)` as a word, declared without `Redacted`. Two declarations are read: a SCREAMING_SNAKE_CASE key of `Schema.Struct({...})`, and the key passed to an Effect `Config` reader such as `Config.String("...")` or `Config.schema(schema, "...")`.

A computed key is resolved through a `const` string or a `const` object of strings in the same file; a key taken from an object imported from elsewhere is judged by its property name turned into SCREAMING_SNAKE_CASE. A schema counts as redacted when it is `Schema.Redacted...(...)`, possibly under `Schema.optionalKey`, `Schema.optional`, `Schema.NullOr`, `Schema.UndefinedOr` or `Schema.NullishOr`, refined with `.check`, `.pipe` or `.annotate`, or held in a `const` of the same file. A `Config` read counts as redacted when it is `Config.Redacted`, reads through such a schema, or is piped into `Config.map(Redacted.make)`. A schema imported from another file cannot be shown to be redacted and is reported.

## Fix

Declare the secret as `Schema.Redacted(<schema>)` in the environment schema, or read it with `Config.Redacted(...)`, and call `Redacted.value` only at the call that hands the secret to the service that needs it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a secret declared as a plain string in the schema is reported
const Environment = Schema.Struct({ AUTH_SECRET: Schema.String });
```

```ts
// a secret read with Config.String is reported
const token = Config.String("GITHUB_TOKEN");
```

Code this rule accepts.

```ts
// a secret declared as Redacted in the schema passes
const Environment = Schema.Struct({ AUTH_SECRET: Schema.Redacted(Schema.String) });
```

```ts
// a secret read with Config.Redacted passes
const token = Config.Redacted("GITHUB_TOKEN");
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the key so it no longer names a secret. The name is how operators and reviewers know the value is secret
- Decoding into a plain string and wrapping it in `Redacted` later. The plain string exists in between and can reach a log or an error

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `plainSecret` | A secret environment key such as \`{{name}}\` must not be declared without \`Redacted\`. Declare it with \`Schema.Redacted(...)\` in the schema, or read it with \`Config.Redacted(...)\`, and unwrap it only where the value is handed to the service that needs it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
