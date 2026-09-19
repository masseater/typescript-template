import {
  noDuplicateValueDeclaration,
  noDuplicatedBody,
  noLocalFiniteValueSet,
  noSplitTypeAuthority,
  noTwinDeclaration,
} from "../../plugin.ts";

import type { WorkspaceLintRule } from "@repo/dont-review-it/lint-rule-authoring";

export const singleOwnershipBundle: readonly WorkspaceLintRule[] = [
  noDuplicateValueDeclaration,
  noDuplicatedBody,
  noLocalFiniteValueSet,
  noSplitTypeAuthority,
  noTwinDeclaration,
];
