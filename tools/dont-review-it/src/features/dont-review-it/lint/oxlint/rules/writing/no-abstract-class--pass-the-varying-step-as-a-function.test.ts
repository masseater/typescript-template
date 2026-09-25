import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noAbstractClass } from "./no-abstract-class--pass-the-varying-step-as-a-function.ts";

describe("dont-review-it/no-abstract-class--pass-the-varying-step-as-a-function", () => {
  testLintRule(noAbstractClass, {
    valid: [
      {
        name: "shared steps written as a function that takes the varying step pass",
        documented: true,
        code: "const runCheck = (check: () => number): number => check() + 1;",
      },
      {
        name: "a concrete class passes",
        code: "class Worker {\n  public fetch(): number {\n    return 1;\n  }\n}",
      },
    ],
    invalid: [
      {
        name: "an abstract class is reported",
        documented: true,
        code: "abstract class Monitor {\n  protected abstract check(): number;\n}",
        errors: [{ messageId: "abstractClass" }],
      },
      {
        name: "an exported abstract class is reported",
        code: "export abstract class Monitor {}",
        errors: [{ messageId: "abstractClass" }],
      },
    ],
  });
});
