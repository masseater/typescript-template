---
description: "Disallow any lint suppression comment and disallow a repository ledger of approved suppressions, so a report ends in a repair to the code or a named exception in the lint configuration and never in a comment or a side file that takes the report away"
---

# no-blanket-suppression--name-and-record

<!-- BEGIN GENERATED rule-header -->

Disallow any lint suppression comment and disallow a repository ledger of approved suppressions, so a report ends in a repair to the code or a named exception in the lint configuration and never in a comment or a side file that takes the report away

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `governance`
- Source: [`no-blanket-suppression--name-and-record.ts`](../../src/lint/oxlint/rules/governance/no-blanket-suppression--name-and-record.ts)

<!-- END GENERATED rule-header -->

## Violation

A suppression comment of any spelling, and a repository root file named `approved-lint-suppressions.json`.

- It names no rule
- It takes a scope other than the one statement below it, so anything but the next-line spelling
- It carries no grounds after `--`. Grounds repeating the rule name, or reading only as "false positive", count as none
- It names a rule, stops at the next statement, and carries grounds. That shape is still a suppression, and is reported
- Read from the lint configuration file, a ledger file at the repository root is reported whether or not any comment still names it

## Fix

Rewrite the code the rule reports. Where the report is wrong, correct the condition that produced it.

Where an exception has to stand for a named file, register it in the lint configuration that names that file. Do not write a suppression comment, and do not add a repository ledger of approved suppressions.

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
// a next-line directive that names its rule and carries grounds is still reported
// oxlint-disable-next-line no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element
element.total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing grounds that name the rule again, or that say only "false positive". Neither reads as grounds, and grounds do not make a suppression acceptable
- Recording the suppression in `approved-lint-suppressions.json`. That file is reported wherever it stands
- Widening the suppression to a range so one comment covers several statements

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unnamedSuppression` | A \`{{spelling}}\` comment must not stand without naming the rule it stops. Delete it and rewrite the code the linter reports. Rewrite the code the rule reports before writing any suppression, and when the report is wrong, correct the condition that produced it instead of covering it. Where an exception has to stand for a named file, register it in the lint configuration that names that file, never in a suppression comment and never in a repository ledger. |
| `wideSuppression` | A \`{{spelling}}\` comment must not take a scope other than the one statement below it. Delete it and rewrite the code the linter reports. Rewrite the code the rule reports before writing any suppression, and when the report is wrong, correct the condition that produced it instead of covering it. Where an exception has to stand for a named file, register it in the lint configuration that names that file, never in a suppression comment and never in a repository ledger. |
| `groundlessSuppression` | A suppression of \`{{ruleNames}}\` must not stand. Delete it and rewrite the code that rule reports. Rewrite the code the rule reports before writing any suppression, and when the report is wrong, correct the condition that produced it instead of covering it. Where an exception has to stand for a named file, register it in the lint configuration that names that file, never in a suppression comment and never in a repository ledger. |
| `standingSuppression` | A suppression of \`{{ruleNames}}\` must not stand, grounds or no grounds. Delete it and rewrite the code that rule reports. Rewrite the code the rule reports before writing any suppression, and when the report is wrong, correct the condition that produced it instead of covering it. Where an exception has to stand for a named file, register it in the lint configuration that names that file, never in a suppression comment and never in a repository ledger. |
| `approvalLedger` | A repository must not hold \`approved-lint-suppressions.json\`. Delete that file, delete every suppression comment it stood for, and rewrite the code those comments covered, or register a named-file exception in the lint configuration. Where an exception has to stand for a named file, register it in the lint configuration that names that file, never in a suppression comment and never in a repository ledger. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
