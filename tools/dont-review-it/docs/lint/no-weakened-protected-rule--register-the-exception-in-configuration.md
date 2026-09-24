---
description: "Disallow silencing a protected rule from a severity the lint configuration lowers, so an exception to one of these rules stands as one registered entry carrying the grounds somebody wrote for it"
---

# no-weakened-protected-rule--register-the-exception-in-configuration

<!-- BEGIN GENERATED rule-header -->

Disallow silencing a protected rule from a severity the lint configuration lowers, so an exception to one of these rules stands as one registered entry carrying the grounds somebody wrote for it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `governance`
- Source: [`no-weakened-protected-rule--register-the-exception-in-configuration.ts`](../../src/features/dont-review-it/lint/oxlint/rules/governance/no-weakened-protected-rule--register-the-exception-in-configuration.ts)

<!-- END GENERATED rule-header -->

## Violation

A protected rule silenced anywhere but a registered exception. Two families are read; suppression comments are rejected by `no-blanket-suppression--name-and-record`.

- A protected rule held in the lint configuration at a level that does not fail a run. Exactly one shape passes: an override whose `files` lists complete paths, one per entry. A pattern among them, an absent or unreadable `files`, and the level standing outside an override are each reported
- An `unprotected` entry that carries no reason, or that names this rule itself. Such an entry takes nothing out of the protected set

`protectedRules` adds to the rule's own list, and `generatedPaths` adds to the build-output locations skipped. Only the repository's `vite.config` file is read as configuration.

## Fix

Rewrite the code the rule reports. Where an exception is genuinely needed, add an override listing the complete path of every file it covers and lower the rule there, or take the rule out of the protected set with an `unprotected` entry stating the grounds.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a protected rule turned off in the configuration is reported
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/forbid-tracked-path--untrack-and-ignore": "off" } } };
```

```ts
// an exception scoped by a pattern is not a registered exception
// in vite.config.ts
export default { lint: { overrides: [{ files: ["packages/*/dist/**"], rules: { "forbid-tracked-path--untrack-and-ignore": "warn" } }] } };
```

Code this rule accepts.

```ts
// a protected rule held at the level that fails a run passes
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/forbid-tracked-path--untrack-and-ignore": "error" } } };
```

```ts
// an override listing the complete path of every file it covers is the registered exception
// in vite.config.ts
export default { lint: { overrides: [{ files: ["packages/cart/src/settings.ts", "apps/site/src/entry.ts"], rules: { "forbid-tracked-path--untrack-and-ignore": "off" } }] } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing the exception's `files` as a pattern, so files added later enter it silently
- Moving the file to a path treated as build output. Only the destination looks like build output

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `weakenedProtectedRule` | A lint configuration must not hold \`{{ruleName}}\`, a rule this package protects, at \`{{severity}}\`. Set it to \`error\`, or move the exception into an override that lists the complete path of every file it covers together with the grounds for it. |
| `patternScopedException` | An override holding \`{{ruleName}}\` at \`{{severity}}\` must not take its scope from the pattern \`{{pattern}}\`. Replace that pattern with the complete path of every file this exception covers. |
| `groundlessDeviation` | A deviation must not take \`{{ruleName}}\` out of the protected list without grounds. Write into that entry what makes the rule an exception, or delete the entry. |
| `selfDeviation` | A deviation must not take \`{{ruleName}}\` out of the protected list. Delete that entry and rewrite the code this rule reports. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
