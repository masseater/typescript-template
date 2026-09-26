---
description: "Disallow a lint suppression comment that covers more than the next line, names no rule, or carries no grounds, and disallow a repository ledger of approved suppressions, so an exception covers only the line it stands above and says why it stands"
---

# no-blanket-suppression--name-and-record

<!-- BEGIN GENERATED rule-header -->

Disallow a lint suppression comment that covers more than the next line, names no rule, or carries no grounds, and disallow a repository ledger of approved suppressions, so an exception covers only the line it stands above and says why it stands

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `governance`
- Source: [`no-blanket-suppression--name-and-record.ts`](../../src/features/dont-review-it/lint/oxlint/rules/governance/no-blanket-suppression--name-and-record.ts)

<!-- END GENERATED rule-header -->

## Violation

A suppression comment that covers more than the next line or cannot say why it stands, and a repository root file named `approved-lint-suppressions.json`.

- It names no rule
- It takes a scope other than the next line: a whole-file directive, a range closed by an enable directive, or a same-line directive
- It uses the eslint spelling of the next-line directive, which this configuration does not read
- It carries no grounds after `--`. Grounds repeating the rule name, or reading only as "false positive", count as none
- It names a rule whose name holds `--`, such as every rule of this package. oxlint reads `--` as the start of the grounds, so the comment stops nothing
- Read from the lint configuration file, a ledger file at the repository root is reported whether or not any comment still names it

## Fix

Rewrite the code the rule reports. Where the report is wrong, correct the condition that produced it.

Where the code has to stay as written, write `oxlint-disable-next-line <rule> -- <grounds>` directly above that one line. Do not widen the exception to a range, a file, or a package, and do not add a repository ledger of approved suppressions.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a whole-file directive naming no rule is reported for naming none
// oxlint-disable
element.total = 1;
```

```ts
// a whole-file directive naming a rule is reported for its scope
/* oxlint-disable no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element */
element.total = 1;
```

```ts
// a directive written without a grounds separator is reported
// oxlint-disable-next-line no-console
element.total = 1;
```

```ts
// a next-line directive naming a rule whose name holds the grounds separator is reported
// oxlint-disable-next-line dont-review-it/no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element
element.total = 1;
```

Code this rule accepts.

```ts
// a next-line directive that names its rule and carries grounds passes
// oxlint-disable-next-line no-console -- the platform interface writes the total back into the element
element.total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing grounds that name the rule again, or that say only "false positive". Neither reads as grounds
- Recording the suppression in `approved-lint-suppressions.json`. That file is reported wherever it stands
- Widening the suppression to a range so one comment covers several statements
- Turning the rule off for a file in the lint configuration instead of writing the comment above the one line

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unnamedSuppression` | A \`{{spelling}}\` comment must name the rule it stops. Rewrite the code the rule reports first, and when the report is wrong, correct the condition that produced it. Where the code has to stay as written, write \`oxlint-disable-next-line <rule> -- <grounds>\` directly above that one line, and never widen the exception to a range, a file, or a package. |
| `wideSuppression` | A \`{{spelling}}\` comment must not take a scope wider than the next line. Delete it. Rewrite the code the rule reports first, and when the report is wrong, correct the condition that produced it. Where the code has to stay as written, write \`oxlint-disable-next-line <rule> -- <grounds>\` directly above that one line, and never widen the exception to a range, a file, or a package. |
| `inertSuppression` | A \`{{spelling}}\` comment stops nothing, since this configuration reads only the oxlint spelling. Delete it. Rewrite the code the rule reports first, and when the report is wrong, correct the condition that produced it. Where the code has to stay as written, write \`oxlint-disable-next-line <rule> -- <grounds>\` directly above that one line, and never widen the exception to a range, a file, or a package. |
| `groundlessSuppression` | A suppression of \`{{ruleNames}}\` must carry its grounds after \`--\` on the same line. Grounds repeating the rule name, or reading only as "false positive", count as none. Rewrite the code the rule reports first, and when the report is wrong, correct the condition that produced it. Where the code has to stay as written, write \`oxlint-disable-next-line <rule> -- <grounds>\` directly above that one line, and never widen the exception to a range, a file, or a package. |
| `unreadableRuleName` | A suppression comment must not name \`{{ruleName}}\`. oxlint reads \`--\` as the start of the grounds, so the comment stops nothing. Delete it, and rewrite the code that rule reports. |
| `approvalLedger` | A repository must not hold \`approved-lint-suppressions.json\`. Delete that file, and write each exception it stood for as a suppression comment above the one line it covers. Where the code has to stay as written, write \`oxlint-disable-next-line <rule> -- <grounds>\` directly above that one line, and never widen the exception to a range, a file, or a package. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
