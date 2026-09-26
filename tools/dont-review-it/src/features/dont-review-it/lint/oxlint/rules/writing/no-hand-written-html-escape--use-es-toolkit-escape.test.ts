import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noHandWrittenHtmlEscape } from "./no-hand-written-html-escape--use-es-toolkit-escape.ts";

describe("dont-review-it/no-hand-written-html-escape--use-es-toolkit-escape", () => {
  testLintRule(noHandWrittenHtmlEscape, {
    valid: [
      {
        name: "escaping through es-toolkit passes",
        documented: true,
        code: 'import { escape } from "es-toolkit";\nconst markup = escape(text);',
      },
      {
        name: "a single replacement into a character reference is not an escaping chain",
        code: 'const markup = text.replaceAll("&", "&amp;");',
      },
      {
        name: "a chain that decodes character references back into characters passes",
        documented: true,
        code: 'const text = markup.replaceAll("&quot;", \'"\').replaceAll("&amp;", "&");',
      },
      {
        name: "a chain of replacements that are not character references passes",
        code: 'const slug = title.replaceAll(" ", "-").replaceAll("/", "-");',
      },
      {
        name: "a replacement computed at run time is not read as a character reference",
        code: "const markup = text.replaceAll(left, amp).replaceAll(right, lt);",
      },
    ],
    invalid: [
      {
        name: "a replaceAll chain into character references is reported once",
        documented: true,
        code: 'const markup = text\n  .replaceAll("&", "&amp;")\n  .replaceAll(\'"\', "&quot;")\n  .replaceAll("<", "&lt;")\n  .replaceAll(">", "&gt;");',
        errors: [{ messageId: "handWrittenEscape" }],
      },
      {
        name: "a replace chain with regular expressions is reported",
        code: 'const markup = text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;");',
        errors: [{ messageId: "handWrittenEscape" }],
      },
      {
        name: "numeric character references are character references",
        code: 'const markup = text.replaceAll("\'", "&#39;").replaceAll("\'", "&#x27;");',
        errors: [{ messageId: "handWrittenEscape" }],
      },
      {
        name: "a chain inside a template literal is reported",
        code: 'const html = `<input value="${text.replaceAll("&", "&amp;").replaceAll(\'"\', "&quot;")}">`;',
        errors: [{ messageId: "handWrittenEscape" }],
      },
      {
        name: "two separate chains are reported separately",
        code: 'const first = a.replaceAll("<", "&lt;").replaceAll(">", "&gt;");\nconst second = b.replaceAll("<", "&lt;").replaceAll(">", "&gt;");',
        errors: [{ messageId: "handWrittenEscape" }, { messageId: "handWrittenEscape" }],
      },
    ],
  });
});
