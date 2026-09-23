import { resolveBinding, type ScopeLookup } from "../resolved-bindings.ts";

import type { ESTree } from "@oxlint/plugins";

const DATA_MODULE_EXTENSION = ".json";

const DATA_IMPORT_ATTRIBUTE = { key: "type", value: DATA_MODULE_EXTENSION.slice(1) } as const;

const attributeKeyOf = (attribute: ESTree.ImportAttribute): string =>
  attribute.key.type === "Identifier" ? attribute.key.name : attribute.key.value;

const importsData = (declaration: ESTree.ImportDeclaration): boolean =>
  declaration.source.value.endsWith(DATA_MODULE_EXTENSION) ||
  declaration.attributes.some(
    (attribute) =>
      attributeKeyOf(attribute) === DATA_IMPORT_ATTRIBUTE.key &&
      attribute.value.value === DATA_IMPORT_ATTRIBUTE.value,
  );

export const isDataImportReference = (
  reference: ESTree.IdentifierReference,
  scopeAt: ScopeLookup,
): boolean =>
  resolveBinding(scopeAt(reference), reference.name)?.defs.some(
    (definition) =>
      definition.type === "ImportBinding" &&
      definition.parent?.type === "ImportDeclaration" &&
      importsData(definition.parent),
  ) ?? false;
