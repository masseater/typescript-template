import type { ESTree } from "@oxlint/plugins";

const CONFIG_TYPE_NAME = "OxlintConfig";

const RULE_RECORD_KEY = "rules";

const indexesConfigRules = (node: ESTree.TSIndexedAccessType): boolean =>
  node.objectType.type === "TSTypeReference" &&
  node.objectType.typeName.type === "Identifier" &&
  node.objectType.typeName.name === CONFIG_TYPE_NAME &&
  node.indexType.type === "TSLiteralType" &&
  node.indexType.literal.type === "Literal" &&
  node.indexType.literal.value === RULE_RECORD_KEY;

const readsRuleRecord = (node: ESTree.TSType): boolean => {
  if (node.type === "TSIndexedAccessType") {
    return indexesConfigRules(node);
  }

  return node.type === "TSTypeReference"
    ? (node.typeArguments?.params ?? []).some(readsRuleRecord)
    : false;
};

export const declaresRuleRecord = (declared: ESTree.VariableDeclarator): boolean => {
  const annotation =
    declared.id.type === "Identifier" ? (declared.id.typeAnnotation ?? null) : null;
  return annotation === null ? false : readsRuleRecord(annotation.typeAnnotation);
};
