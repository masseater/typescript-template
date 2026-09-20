import {
  noDuplicateValueDeclaration,
  noDuplicatedBody,
  noLocalFiniteValueSet,
  noSplitTypeAuthority,
  noTwinDeclaration,
} from "../../plugin.ts";

import type { WorkspaceLintRule } from "../../lint-rule-authoring/index.ts";

export const singleOwnershipBundle: readonly WorkspaceLintRule[] = [
  noDuplicateValueDeclaration,
  noDuplicatedBody,
  noLocalFiniteValueSet,
  noSplitTypeAuthority,
  noTwinDeclaration,
];
