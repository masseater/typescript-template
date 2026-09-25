---
description: "Disallow declaring an abstract class, so shared behaviour is reached through calls a reader can follow instead of through members a subclass inherits and overrides"
---

# no-abstract-class--pass-the-varying-step-as-a-function

<!-- BEGIN GENERATED rule-header -->

Disallow declaring an abstract class, so shared behaviour is reached through calls a reader can follow instead of through members a subclass inherits and overrides

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-abstract-class--pass-the-varying-step-as-a-function.ts`](../../src/features/dont-review-it/lint/oxlint/rules/writing/no-abstract-class--pass-the-varying-step-as-a-function.ts)

<!-- END GENERATED rule-header -->

## Violation

A class declaration or class expression marked `abstract`. An abstract class exists to hand its members to subclasses, which fill in the abstract ones and inherit the rest.

## Fix

Write the shared steps as functions and pass the step that varies as an argument. A caller that still needs a class, such as a runtime that instantiates it by name, gets a concrete class whose methods call those functions.

```ts
const runMonitor = ({ check }: { readonly check: (notify: Notify) => Effect.Effect<object> }) =>
  Effect.flatMap(notifier, check);
```

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an abstract class is reported
abstract class Monitor {
  protected abstract check(): number;
}
```

Code this rule accepts.

```ts
// shared steps written as a function that takes the varying step pass
const runCheck = (check: () => number): number => check() + 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Dropping the `abstract` keyword and throwing from the methods a subclass is meant to override. The class is still reused through inheritance

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `abstractClass` | A class must not be declared \`abstract\`. Write the shared steps as functions and pass the step that varies to them as a function argument. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
