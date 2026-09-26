import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noCallerNameBranch } from "./no-caller-name-branch--read-the-per-caller-table.ts";

const CALLERS = [{ callers: [{ source: "@repo/config", name: "APPLICATION" }] }];

describe("dont-review-it/no-caller-name-branch--read-the-per-caller-table", () => {
  testLintRule(noCallerNameBranch, {
    valid: [
      {
        name: "reading the row for the caller from a table passes",
        documented: true,
        code: `import { applicationTraits } from "@repo/config";\nexport const crons = (target) => applicationTraits[target].crons;\n`,
        options: CALLERS,
      },
      {
        name: "passing a named caller along without comparing it passes",
        code: `import { APPLICATION } from "@repo/config";\nexport const origin = originOf(APPLICATION.serviceMember);\n`,
        options: CALLERS,
      },
      {
        name: "a vocabulary of the same name from another module is left alone",
        code: `import { APPLICATION } from "./local.ts";\nexport const member = (target) => target === APPLICATION.serviceMember;\n`,
        options: CALLERS,
      },
      {
        name: "a rule with no configured vocabulary reports nothing",
        code: `import { APPLICATION } from "@repo/config";\nexport const member = (target) => target === APPLICATION.serviceMember;\n`,
      },
    ],
    invalid: [
      {
        name: "comparing the input against one named caller is reported",
        documented: true,
        code: `import { APPLICATION } from "@repo/config";\nexport const crons = (target) => (target === APPLICATION.serviceMember ? ["0 4 * * *"] : []);\n`,
        options: CALLERS,
        errors: [{ messageId: "callerBranch" }],
      },
      {
        name: "an early return for every caller but one is reported",
        code: `import { APPLICATION as App } from "@repo/config";\nexport const env = (target, shared) => { if (App.internalDashboard !== target) return shared; return { ...shared, wiki: true }; };\n`,
        options: CALLERS,
        errors: [{ messageId: "callerBranch" }],
      },
      {
        name: "a switch case naming a caller is reported",
        code: `import { APPLICATION } from "@repo/config";\nexport const label = (target) => { switch (target) { case APPLICATION.serviceAdmin: return "admin"; default: return "other"; } };\n`,
        options: CALLERS,
        errors: [{ messageId: "callerBranch" }],
      },
    ],
  });
});
