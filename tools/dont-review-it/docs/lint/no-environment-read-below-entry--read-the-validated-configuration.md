---
description: "Disallow reading a key of `process.env`, `import.meta.env` or a Worker's `env` outside the entry files that validate the environment with a schema, so every setting reaches the code below them already checked and typed"
---

# no-environment-read-below-entry--read-the-validated-configuration

<!-- BEGIN GENERATED rule-header -->

Disallow reading a key of `process.env`, `import.meta.env` or a Worker's `env` outside the entry files that validate the environment with a schema, so every setting reaches the code below them already checked and typed

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `writing`
- Source: [`no-environment-read-below-entry--read-the-validated-configuration.ts`](../../src/features/dont-review-it/lint/oxlint/rules/writing/no-environment-read-below-entry--read-the-validated-configuration.ts)

<!-- END GENERATED rule-header -->

## Violation

A key read from the environment outside the files listed in `entryFiles`. The environment is `process.env` (also through `globalThis.process`), `import.meta.env`, the `env` exported by `cloudflare:workers` (under any local name or through a namespace import), `this.env` inside a class that extends a class imported from `cloudflare:workers`, and the second parameter of a `fetch`, `scheduled`, `queue`, `email`, `tail` or `trace` handler on the default-exported object. A key read is a member access, static or computed, or a property destructured from one of these, including through a `const` alias of it.

Handing the whole environment to something, spreading it, assigning a key and deleting a key are not reads. An environment object that reaches a function as a typed parameter is not followed, so a read there is left to the type of that parameter.

## Fix

Declare the key in the schema of the entry file, decode the whole environment there once, and pass the decoded value down to the code that needs it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a key read from process.env is reported
export const origin = process.env.APP_ORIGIN;
```

```ts
// a key read from the Worker env import is reported
import { env } from "cloudflare:workers";
export const origin = env.APP_ORIGIN;
```

Code this rule accepts.

```ts
// the whole environment handed to the schema that validates it passes
export const config = decodeEnvironment(process.env);
```

```ts
// a key read inside a listed entry file passes
// in /repo/libs/config/src/process-environment.ts
const environment = process.env;
export const setting = (key: string) => environment[key];
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Wrapping the read in a helper outside the entry files. The helper is the read and is reported
- Adding a file to `entryFiles` because it reads a key. The option names the one place that validates the environment, not the places that read it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `environmentRead` | A key of the process environment or of a Worker's \`env\` must not be read here. Declare the key in the schema of the entry file that validates the environment, and take the validated value from what that entry hands down. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
