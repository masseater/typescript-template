---
description: "Disallow a `reduce` whose callback only adds each element onto the accumulator and a `Math.min` nested in `Math.max` or the reverse, so a total is written with `sum` or `sumBy` and a bound with `clamp` from es-toolkit instead of being rebuilt at each call site"
---

# no-hand-rolled-sum-or-clamp--use-es-toolkit

<!-- BEGIN GENERATED rule-header -->

Disallow a `reduce` whose callback only adds each element onto the accumulator and a `Math.min` nested in `Math.max` or the reverse, so a total is written with `sum` or `sumBy` and a bound with `clamp` from es-toolkit instead of being rebuilt at each call site

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-hand-rolled-sum-or-clamp--use-es-toolkit.ts`](../../src/features/dont-review-it/lint/oxlint/rules/writing/no-hand-rolled-sum-or-clamp--use-es-toolkit.ts)

<!-- END GENERATED rule-header -->

## Violation

A `reduce` call with a seed whose callback is written inline, takes the accumulator as a plain identifier, and returns nothing but the accumulator added to something with `+`, on either side. The callback may be an arrow with an expression body or a function whose body is one `return`. A seed that is a string or template literal is left alone, because that reduce joins text rather than adding numbers.

A call to `Math.min` or `Math.max` with two arguments, one of which is a two-argument call to the other one.

es-toolkit already owns a total and a bound, and a hand-written total or bound at each call site is a second copy of that behaviour, written a little differently each time. The detection reads syntax only: a callback passed by reference, a counter kept in a loop, and a bound split across two statements are not reported.

## Fix

Write `sum(values)` for a list of numbers and `sumBy(items, (item) => item.count)` for a number taken from each element, both from `es-toolkit`. When the seed is not 0, add it outside: `first.rows + sumBy(rest, (page) => page.rows)`.

Write `clamp(value, minimum, maximum)` from `es-toolkit` for a value kept between two bounds.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a reduce that adds each element onto a zero seed is reported
const total = values.reduce((carried, value) => carried + value, 0);
```

```ts
// a Math.max nested in Math.min is reported
const bounded = Math.min(Math.max(value, 0), maximum);
```

Code this rule accepts.

```ts
// summing with es-toolkit is the accepted spelling
import { sumBy } from 'es-toolkit';
const total = sumBy(rows, (row) => row.count);
```

```ts
// bounding with es-toolkit is the accepted spelling
import { clamp } from 'es-toolkit';
const bounded = clamp(value, 0, maximum);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the addition into a named function and passing it to `reduce` by reference. The total is still built by hand
- Replacing the reduce with a loop that adds onto a `let`, or splitting the two bounds into two statements, so the same logic stays at the call site

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `handRolledSum` | A total must not be built by a \`reduce\` that adds each element onto the accumulator. Write \`sum(values)\` or \`sumBy(items, (item) => item.count)\` from "es-toolkit", and add a starting value other than 0 outside the call. |
| `handRolledClamp` | A value must not be bounded by nesting \`Math.min\` and \`Math.max\`. Write \`clamp(value, minimum, maximum)\` from "es-toolkit". |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
