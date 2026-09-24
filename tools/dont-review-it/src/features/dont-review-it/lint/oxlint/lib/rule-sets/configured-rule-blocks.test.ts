import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { objectValueOf } from "../object-literal.ts";
import { configuredRuleBlockOf, ruleBlockObjectOf } from "./configured-rule-blocks.ts";

import type { ESTree } from "@oxlint/plugins";

const configurationWritten = (code: string): ESTree.ObjectExpression => {
  const statement = parseSync("config.ts", code).program.body[0] as ESTree.Statement;
  if (statement.type !== "VariableDeclaration") throw new Error("nothing was declared");
  const configLiteral = statement.declarations[0]?.init;
  if (configLiteral?.type !== "ObjectExpression") throw new Error("no object was written");
  return configLiteral;
};

const overrideWritten = (configLiteral: ESTree.ObjectExpression): ESTree.ObjectExpression => {
  const overrides = objectValueOf({ object: configLiteral, key: "overrides" });
  const [overrideLiteral] = overrides?.type === "ArrayExpression" ? overrides.elements : [];
  if (overrideLiteral?.type !== "ObjectExpression")
    throw new Error("no override object was written");
  return overrideLiteral;
};

const blockOf = (
  object: ESTree.ObjectExpression,
  ancestors: readonly ESTree.ObjectExpression[],
): ReturnType<typeof configuredRuleBlockOf> => {
  const rules = ruleBlockObjectOf(object);
  if (rules === null) throw new Error("no rules object was written");
  return configuredRuleBlockOf({ object, rules, ancestors });
};

describe("ruleBlockObjectOf", () => {
  describe("a configuration carrying coverage instead of rules", () => {
    const it = test.extend("rulesObject", () =>
      ruleBlockObjectOf(configurationWritten(`const config = { test: { coverage: {} } };`)));

    it("holds no rules object", ({ rulesObject }) => {
      expect(rulesObject).toBe(null);
    });
  });

  describe("a configuration naming rules it keeps elsewhere", () => {
    const it = test.extend("rulesObject", () =>
      ruleBlockObjectOf(configurationWritten(`const config = { rules: elsewhere };`)));

    it("holds no rules object", ({ rulesObject }) => {
      expect(rulesObject).toBe(null);
    });
  });
});

describe("configuredRuleBlockOf", () => {
  describe("a rules object spelling three severities", () => {
    const it = test.extend("block", () =>
      blockOf(
        configurationWritten(
          `const config = { rules: { "a": "error", "b": ["warn", {}], "c": 0 } };`,
        ),
        [],
      ));

    it("comes out with the level each rule sits at", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "a", raw: '"a"', start: 26, end: 29 },
              value: { type: "Literal", value: "error", raw: '"error"', start: 31, end: 38 },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 26,
              end: 38,
            },
            ruleName: "a",
            level: "error",
          },
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "b", raw: '"b"', start: 40, end: 43 },
              value: {
                type: "ArrayExpression",
                elements: [
                  { type: "Literal", value: "warn", raw: '"warn"', start: 46, end: 52 },
                  { type: "ObjectExpression", properties: [], start: 54, end: 56 },
                ],
                start: 45,
                end: 57,
              },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 40,
              end: 57,
            },
            ruleName: "b",
            level: "warn",
          },
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "c", raw: '"c"', start: 59, end: 62 },
              value: { type: "Literal", value: 0, raw: "0", start: 64, end: 65 },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 59,
              end: 65,
            },
            ruleName: "c",
            level: "off",
          },
        ],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a rule whose severity this reader cannot resolve", () => {
    const it = test.extend("block", () =>
      blockOf(configurationWritten(`const config = { rules: { "a": chosenSeverity } };`), []));

    it("keeps no level", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [
          {
            property: {
              type: "Property",
              kind: "init",
              key: { type: "Literal", value: "a", raw: '"a"', start: 26, end: 29 },
              value: {
                type: "Identifier",
                decorators: [],
                name: "chosenSeverity",
                optional: false,
                typeAnnotation: null,
                start: 31,
                end: 45,
              },
              method: false,
              shorthand: false,
              computed: false,
              optional: false,
              start: 26,
              end: 45,
            },
            ruleName: "a",
            level: null,
          },
        ],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("keys assembled while the run starts", () => {
    const it = test.extend("block", () =>
      blockOf(
        configurationWritten(`const config = { rules: { [computed]: "error", ...shared } };`),
        [],
      ));

    it("name no rule this reader can hold", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration naming no files", () => {
    const it = test.extend("block", () =>
      blockOf(configurationWritten(`const config = { rules: {} };`), []));

    it("covers the whole run", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration naming two paths", () => {
    const it = test.extend("block", () =>
      blockOf(
        configurationWritten(
          `const config = { files: ["apps/site/**", "packages/cart/**"], rules: {} };`,
        ),
        [],
      ));

    it("carries the paths it covers", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: ["apps/site/**", "packages/cart/**"],
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration naming paths it keeps elsewhere", () => {
    const it = test.extend("block", () =>
      blockOf(configurationWritten(`const config = { files: chosenPaths, rules: {} };`), []));

    it("holds no path in the scope it covers", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration listing paths this reader cannot spell", () => {
    const it = test.extend("block", () =>
      blockOf(configurationWritten(`const config = { files: [chosenPath, 1], rules: {} };`), []));

    it("holds no path in the scope it covers", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration turning type awareness on", () => {
    const it = test.extend("block", () =>
      blockOf(
        configurationWritten(`const config = { options: { typeAware: true }, rules: {} };`),
        [],
      ));

    it("declares it for its own block", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: true,
      });
    });
  });

  describe("a configuration leaving type awareness unspelled", () => {
    const it = test.extend("block", () =>
      blockOf(configurationWritten(`const config = { rules: {} };`), []));

    it("declares none", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration turning type awareness off", () => {
    const it = test.extend("block", () =>
      blockOf(
        configurationWritten(`const config = { options: { typeAware: false }, rules: {} };`),
        [],
      ));

    it("declares none", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("a configuration keeping its options elsewhere", () => {
    const it = test.extend("block", () =>
      blockOf(configurationWritten(`const config = { options: chosenOptions, rules: {} };`), []));

    it("declares none", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: null,
        declaresTypeAwareness: false,
      });
    });
  });

  describe("an override read under the configuration around it", () => {
    const it = test.extend("block", () => {
      const configLiteral = configurationWritten(
        `const config = { options: { typeAware: true }, overrides: [{ files: [], rules: {} }] };`,
      );
      return blockOf(overrideWritten(configLiteral), [configLiteral]);
    });

    it("takes the type awareness that configuration declares", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: true,
      });
    });
  });

  describe("an override read on its own", () => {
    const it = test.extend("block", () =>
      blockOf(
        overrideWritten(
          configurationWritten(
            `const config = { options: { typeAware: true }, overrides: [{ files: [], rules: {} }] };`,
          ),
        ),
        [],
      ));

    it("declares no type awareness", ({ block }) => {
      expect(block).toStrictEqual({
        rules: [],
        scope: [],
        declaresTypeAwareness: false,
      });
    });
  });
});
