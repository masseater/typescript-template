import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { propertyKeyOf } from "../../lib/object-literal.ts";
import {
  declaredJsPluginNamesIn,
  declaredPluginNamesIn,
} from "../../lib/rule-plugins/declared-plugin-names.ts";
import { declaresRuleRecord } from "../../lib/rule-plugins/rule-record-declarations.ts";
import { ruleBlockObjectOf } from "../../lib/rule-sets/configured-rule-blocks.ts";
import { severityLevelOf, SILENT_LEVEL } from "../../lib/rule-sets/severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";

const listedPluginsOf = (ruleOptions: readonly unknown[]): readonly string[] => {
  const [held] = ruleOptions;
  if (held === null || typeof held !== "object") return [];
  const listed = (held as { readonly plugins?: unknown }).plugins;
  return Array.isArray(listed)
    ? listed.filter((named): named is string => typeof named === "string")
    : [];
};

type NamedRule = {
  readonly property: ESTree.ObjectProperty;
  readonly plugin: string;
  readonly ruleName: string;
};

const PLUGIN_SEPARATOR = "/";

const namedRulesIn = (rules: ESTree.ObjectExpression): readonly NamedRule[] =>
  rules.properties.flatMap<NamedRule>((property) => {
    if (property.type !== "Property") return [];
    const ruleName = propertyKeyOf(property);
    if (ruleName === null || !ruleName.includes(PLUGIN_SEPARATOR)) return [];
    if (severityLevelOf(property.value) === SILENT_LEVEL) return [];
    return [{ property, plugin: ruleName.slice(0, ruleName.indexOf(PLUGIN_SEPARATOR)), ruleName }];
  });

const LINT_CONFIGURATION_MODULES = ["oxlint", "vite-plus", "dont-review-it"];

const namesALintConfigurationModule = (specifier: string): boolean =>
  LINT_CONFIGURATION_MODULES.some(
    (named) =>
      specifier === named || specifier.startsWith(`${named}/`) || specifier.endsWith(`/${named}`),
  );

const foreignConfigurationBuildersIn = (program: ESTree.Program): ReadonlySet<string> =>
  new Set(
    program.body.flatMap((statement) =>
      statement.type === "ImportDeclaration" &&
      typeof statement.source.value === "string" &&
      !namesALintConfigurationModule(statement.source.value)
        ? statement.specifiers.map((specifier) => specifier.local.name)
        : [],
    ),
  );

const calleeRootNameOf = (callee: ESTree.Node): string | null => {
  if (callee.type === "Identifier") return callee.name;
  return callee.type === "MemberExpression" ? calleeRootNameOf(callee.object) : null;
};

const isBuiltByAForeignTool = (
  rules: ESTree.ObjectExpression,
  foreignBuilders: ReadonlySet<string>,
): boolean => {
  const enclosing = (node: ESTree.Node | null | undefined): boolean => {
    if (node === null || node === undefined) return false;
    if (node.type === "CallExpression") {
      const rootName = calleeRootNameOf(node.callee);
      return rootName !== null && foreignBuilders.has(rootName);
    }
    return enclosing(node.parent);
  };
  return enclosing(rules.parent);
};

const ruleBlocksIn = (program: ESTree.Program): readonly ESTree.ObjectExpression[] => [
  ...nodesOfType(program, "ObjectExpression").flatMap((holder) => {
    const rules = ruleBlockObjectOf(holder);
    return rules === null ? [] : [rules];
  }),
  ...nodesOfType(program, "VariableDeclarator").flatMap((declared) =>
    declaresRuleRecord(declared) && declared.init?.type === "ObjectExpression"
      ? [declared.init]
      : [],
  ),
];

export const noUnregisteredRulePlugin = createDontReviewItRule({
  name: "no-unregistered-rule-plugin--enable-the-plugin",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a lint configuration naming a rule of a plugin that no plugin list it can reach enables, so a rule left standing on a dropped plugin is reported instead of resolving to nothing",
      relatedGuidelines: ["apps/wiki/content/docs/guidelines/enforcement.md"],
    },
    messages: {
      unregisteredRulePlugin:
        "A lint configuration must not name `{{ruleName}}` while the `{{plugin}}` plugin stands outside every plugin list it hands out. Add `{{plugin}}` to that plugin list, or delete the rule.",
    },
    schema: [
      {
        type: "object",
        properties: {
          plugins: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    return {
      "Program:exit"(program: ESTree.Program) {
        const enabledPlugins: ReadonlySet<string> = new Set([
          ...listedPluginsOf(inspection.options),
          ...nodesOfType(program, "ObjectExpression").flatMap((holder) => [
            ...declaredPluginNamesIn(holder),
            ...declaredJsPluginNamesIn(holder),
          ]),
        ]);

        const foreignBuilders = foreignConfigurationBuildersIn(program);
        const configuredBlocks = ruleBlocksIn(program).filter(
          (rules) => !isBuiltByAForeignTool(rules, foreignBuilders),
        );

        for (const named of configuredBlocks.flatMap(namedRulesIn)) {
          if (enabledPlugins.has(named.plugin)) continue;
          inspection.report({
            node: named.property,
            messageId: "unregisteredRulePlugin",
            data: { plugin: named.plugin, ruleName: named.ruleName },
          });
        }
      },
    };
  },
});
