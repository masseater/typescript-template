---
description: "Disallow taking a rule of the parallel determinism gate out of a run through a lowered severity or an ignore entry, leaving the code the rule stands on as the only place a report ends"
---

# no-rule-suppression--fix-the-violation

<!-- BEGIN GENERATED rule-header -->

Disallow taking a rule of the parallel determinism gate out of a run through a lowered severity or an ignore entry, leaving the code the rule stands on as the only place a report ends

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `governance`
- Source: [`no-rule-suppression--fix-the-violation.ts`](../../src/features/dont-review-it/lint/oxlint/rules/governance/no-rule-suppression--fix-the-violation.ts)

<!-- END GENERATED rule-header -->

## Violation

A rule of the parallel determinism gate taken out of a run. The gate holds the rules that keep one test from starting on the state another left behind, and `targetRules` adds to that list.

Reported: an entry holding one of them at `off` or `warn`, with or without an override scope; a severity this rule cannot read; a configuration handing suppression comments back their force through `respectEslintDisableDirectives`; and an ignore entry covering an authored spec file. Suppression comments are rejected by `no-blanket-suppression--name-and-record`.

## Fix

Delete the entry and rewrite the code the reopened reports stand on. To change the discipline a rule carries, change the rule's definition.

Narrow an ignore pattern to the generated paths it stands for.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a configuration turning a gate rule off is reported
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/no-redundant-mock-reset--lift-mocks-into-fixture": "off" } } };
```

Code this rule accepts.

```ts
// a configuration holding a gate rule at error passes
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/no-redundant-mock-reset--lift-mocks-into-fixture": "error" } } };
```

```ts
// a configuration turning a rule outside this gate off passes
// in vite.config.ts
export default { lint: { rules: { "no-console": "off" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Lowering the entry to `warn`. A warning takes the rule out of the run all the same
- Writing the severity behind a value assembled elsewhere so the level cannot be read
- Setting `respectEslintDisableDirectives` to `true` to give the comments their force back

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `weakenedRule` | A lint configuration must not hold \`{{ruleName}}\`, a rule of the parallel determinism gate, at \`{{severity}}\`. This entry takes the rule out of every run, and the invariant it carries goes unchecked across the whole tree. Set this entry to \`error\`, then rewrite the code the rule reports. |
| `scopedWeakenedRule` | An override must not hold \`{{ruleName}}\`, a rule of the parallel determinism gate, at \`{{severity}}\` over {{scope}}. Those paths keep the code the rule reports and lose the report itself. Delete this entry, then rewrite the code the rule reports over those paths. |
| `unreadableSeverity` | A severity this rule cannot read must not stand on \`{{ruleName}}\`, a rule of the parallel determinism gate. A value assembled elsewhere hides the level this gate runs at. Write the severity of this entry as the literal \`error\`. |
| `respectedDisableDirectives` | A lint configuration must not hand the suppression comments of a run back their force. Every comment naming a rule of the parallel determinism gate starts taking that rule out of the run again. Set this entry to \`false\`, then delete the comments it was standing for. |
| `ignoredSpecFile` | An ignore entry must not cover a file this gate reads. \`{{pattern}}\` covers \`{{matchedPath}}\`, an authored spec file, and every rule of the gate stops reporting over it. Narrow that pattern to the generated paths it stands for, or delete it and rewrite the code the gate reports. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
