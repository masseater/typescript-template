---
description: "Disallow a lint configuration lowering a rule that keeps one declaration in one place, or ignoring a path outside the regions the repository excludes, so what the linter stops saying is a decision somebody wrote down"
---

# no-silent-suppression--fix-or-register-the-deviation

<!-- BEGIN GENERATED rule-header -->

Disallow a lint configuration lowering a rule that keeps one declaration in one place, or ignoring a path outside the regions the repository excludes, so what the linter stops saying is a decision somebody wrote down

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `governance`
- Source: [`no-silent-suppression--fix-or-register-the-deviation.ts`](../../src/features/dont-review-it/lint/oxlint/rules/governance/no-silent-suppression--fix-or-register-the-deviation.ts)

<!-- END GENERATED rule-header -->

## Violation

A lint configuration that takes a report away from one of the guarded rules instead of letting it end in a repair or a registered deviation. Three shapes are reported.

- A configuration holding a guarded rule at a level that leaves a run green
- An ignore pattern naming a place outside the regions this repository declares as excluded from the walk
- An ignore pattern covering a path registered as forbidden

`guardedRules`, `excludedRegions` and `forbiddenPaths` settle those three lists. Suppression comments are rejected by `no-blanket-suppression--name-and-record`.

## Fix

Rewrite the code the rule reports, or register the deviation in the list that rule keeps.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a guarded rule turned off in the configuration is reported
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/no-split-type-authority--rename-or-unify": "off" } } };
```

```ts
// an ignore pattern naming a place outside the declared regions is reported
// in vite.config.ts
export default { lint: { ignorePatterns: ["**/dist/**", "packages/legacy/**"] } };
```

Code this rule accepts.

```ts
// a guarded rule held at the level that fails a run passes
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/no-split-type-authority--rename-or-unify": "error" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Lowering the rule in the configuration instead. A green run is what the lowering buys
- Adding an ignore pattern over the path the report stands on

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `weakenedRule` | A lint configuration must not hold \`{{ruleName}}\` at \`{{severity}}\`, a level that leaves a run green. Set it to \`error\`, rewrite the code that rule reports, or register the deviation in the list that rule keeps. |
| `undeclaredIgnoredRegion` | An ignore pattern must not name \`{{pattern}}\`, a place outside the regions this repository excludes from the walk. Delete the pattern and rewrite the code it hides, or declare the region in the definition this configuration receives. |
| `ignoredForbiddenPath` | An ignore pattern must not cover \`{{forbiddenPath}}\`, a path registered as forbidden. Delete the pattern, and delete that file or move it to the place its owner names. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
