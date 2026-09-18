import { createDontReviewItRule } from "../../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const isAmbientModule = (node: ESTree.Node): boolean =>
  node.type === "TSModuleDeclaration" && (node.declare || node.kind === "global");

const mergesIntoAnAmbientModule = (node: ESTree.Node): boolean => {
  const { parent } = node;
  if (parent === null) return false;
  return isAmbientModule(parent) || mergesIntoAnAmbientModule(parent);
};

export const noInterfaceDeclaration = createDontReviewItRule({
  name: "no-interface-declaration--write-a-type-alias",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow declaring an object type with an interface outside an ambient module, so every object type is written one way and only the declarations that must merge into a module or the global scope keep the form that merges",
      relatedGuidelines: ["apps/wiki/content/docs/guidelines/writing-code.md"],
    },
    messages: {
      interfaceDeclaration:
        "An object type must not be declared with `interface` here. Write it as a `type` alias. Only an `interface` inside `declare module`, `declare global` or `declare namespace` stays.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      TSInterfaceDeclaration(node) {
        if (mergesIntoAnAmbientModule(node)) return;
        inspection.report({ node, messageId: "interfaceDeclaration" });
      },
    };
  },
});
