---
description: "Disallow environment keys that exist only to change behaviour under test (`MOCK_*`, `SKIP_*`, `FAKE_*`, `STUB_*`, `DUMMY_*`, `TEST_*`), so the code under test runs the same path it runs in production"
---

# no-test-only-environment-key--use-real-dependencies-and-http-doubles

<!-- BEGIN GENERATED rule-header -->

Disallow environment keys that exist only to change behaviour under test (`MOCK_*`, `SKIP_*`, `FAKE_*`, `STUB_*`, `DUMMY_*`, `TEST_*`), so the code under test runs the same path it runs in production

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-test-only-environment-key--use-real-dependencies-and-http-doubles.ts`](../../src/features/dont-review-it/lint/oxlint/rules/writing/no-test-only-environment-key--use-real-dependencies-and-http-doubles.ts)

<!-- END GENERATED rule-header -->

## Violation

An environment key that starts with `MOCK_`, `SKIP_`, `FAKE_`, `STUB_`, `DUMMY_` or `TEST_`. Such a key exists only to make the code take another path under test, so the path the test checks is not the one production runs. The key is read where it is declared in an environment schema, passed to an Effect `Config` reader, or read from `process.env`, `import.meta.env` or a Worker's `env`.

## Fix

Run the real dependency in the test and replace only external HTTP at the network boundary, so the code under test takes the path production takes.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a mock switch read from the process environment is reported
export const payments = process.env.MOCK_PAYMENTS === 'true' ? fake : stripe;
```

Code this rule accepts.

```ts
// a key the production path needs as well passes
const Environment = Schema.Struct({ STRIPE_SECRET_KEY: Schema.Redacted(Schema.String) });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the key so it no longer starts with a watched prefix. It still exists only for tests
- Detecting a test run from another value, such as a test runner's own variable, to take the same other path

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `testOnlyKey` | An environment key such as \`{{name}}\` must not change behaviour only for tests. Use the real dependency in the test and replace only external HTTP at the network boundary. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
