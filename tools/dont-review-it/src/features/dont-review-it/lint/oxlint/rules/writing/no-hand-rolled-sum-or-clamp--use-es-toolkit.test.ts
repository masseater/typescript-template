import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noHandRolledSumOrClamp } from "./no-hand-rolled-sum-or-clamp--use-es-toolkit.ts";

describe("dont-review-it/no-hand-rolled-sum-or-clamp--use-es-toolkit", () => {
  testLintRule(noHandRolledSumOrClamp, {
    valid: [
      {
        name: "summing with es-toolkit is the accepted spelling",
        documented: true,
        code: "import { sumBy } from 'es-toolkit';\nconst total = sumBy(rows, (row) => row.count);",
      },
      {
        name: "bounding with es-toolkit is the accepted spelling",
        documented: true,
        code: "import { clamp } from 'es-toolkit';\nconst bounded = clamp(value, 0, maximum);",
      },
      {
        name: "a reduce that keeps the larger element is not a total",
        code: "const largest = values.reduce((best, value) => (value > best ? value : best), 0);",
      },
      {
        name: "a reduce that multiplies is not a total",
        code: "const product = values.reduce((carried, value) => carried * value, 1);",
      },
      {
        name: "a reduce that joins text onto a text seed is not a numeric total",
        code: "const joined = parts.reduce((text, part) => text + part, '');",
      },
      {
        name: "a reduce that joins onto a template seed is not a numeric total",
        code: "const joined = parts.reduce((text, part) => text + part, ``);",
      },
      {
        name: "a reduce without a seed is left to the reduce itself",
        code: "const total = values.reduce((carried, value) => carried + value);",
      },
      {
        name: "a reduce whose callback is a reference is not read",
        code: "const total = values.reduce(addUp, 0);",
      },
      {
        name: "an accumulator taken apart by a pattern is not added onto",
        code: "const total = values.reduce(([carried], value) => carried + value, 0);",
      },
      {
        name: "adding two values that are neither the accumulator is not a total",
        code: "const total = values.reduce((carried, value) => value + offset, 0);",
      },
      {
        name: "a block body with work beside the return is not a plain total",
        code: "const total = values.reduce((carried, value) => {\n  record(value);\n  return carried + value;\n}, 0);",
      },
      {
        name: "a block body that returns nothing is not a total",
        code: "values.reduce((carried, value) => {\n  record(carried, value);\n}, 0);",
      },
      {
        name: "a computed reduce member is not read",
        code: "const total = values['reduce']((carried, value) => carried + value, 0);",
      },
      {
        name: "one Math.min on its own is a single bound",
        code: "const bounded = Math.min(value, maximum);",
      },
      {
        name: "Math.max nested in Math.max is not a clamp",
        code: "const bounded = Math.max(Math.max(first, second), third);",
      },
      {
        name: "a Math.min over more than two values is not a clamp",
        code: "const bounded = Math.min(Math.max(value, 0), maximum, limit);",
      },
      {
        name: "a min of another object is not the Math bound",
        code: "const bounded = range.min(Math.max(value, 0), maximum);",
      },
    ],
    invalid: [
      {
        name: "a reduce that adds each element onto a zero seed is reported",
        documented: true,
        code: "const total = values.reduce((carried, value) => carried + value, 0);",
        errors: [{ messageId: "handRolledSum" }],
      },
      {
        name: "a reduce that adds a field of each element is reported",
        code: "const total = rows.reduce((carried, row) => carried + row.count, 0);",
        errors: [{ messageId: "handRolledSum" }],
      },
      {
        name: "adding with the accumulator on the right is reported",
        code: "const total = rows.reduce((carried, row) => row.count + carried, 0);",
        errors: [{ messageId: "handRolledSum" }],
      },
      {
        name: "a seed other than zero is reported as a total plus a starting value",
        code: "const total = pages.reduce((carried, page) => carried + page.rows, first.rows);",
        errors: [{ messageId: "handRolledSum" }],
      },
      {
        name: "a block body that only returns the addition is reported",
        code: "const total = values.reduce(function (carried, value) {\n  return carried + value;\n}, 0);",
        errors: [{ messageId: "handRolledSum" }],
      },
      {
        name: "a Math.max nested in Math.min is reported",
        documented: true,
        code: "const bounded = Math.min(Math.max(value, 0), maximum);",
        errors: [{ messageId: "handRolledClamp" }],
      },
      {
        name: "a Math.min nested in Math.max is reported",
        code: "const bounded = Math.max(Math.min(value, maximum), 0);",
        errors: [{ messageId: "handRolledClamp" }],
      },
      {
        name: "the nested bound in the second argument is reported",
        code: "const bounded = Math.min(maximum, Math.max(0, value));",
        errors: [{ messageId: "handRolledClamp" }],
      },
    ],
  });
});
