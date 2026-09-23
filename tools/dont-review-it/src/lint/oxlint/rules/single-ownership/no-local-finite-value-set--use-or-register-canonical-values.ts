import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  canonicalValueKey,
  type CanonicalValuesCatalog,
  type CanonicalValuesEntry,
} from "../../lib/canonical-values/catalog.ts";
import { analyzeLocalFiniteValues } from "../../lib/canonical-values/local-finite-value-analysis.ts";
import {
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../../lib/canonical-values/ownership-policy.ts";
import { formatValues } from "../../lib/canonical-values/verify-format.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { describeLibraryOwner } from "../../lib/library-vocabulary/owner-description.ts";
import { libraryOwnersOf } from "../../lib/library-vocabulary/vocabulary-index.ts";
import { isOutOfScopeLintSource } from "../../lib/out-of-scope-source.ts";

import type { WorkspaceLintRule } from "../../../../lint-rule-authoring/index.ts";
import type { CanonicalValuesCatalogLoader } from "../../lib/canonical-values/catalog-loader.ts";
import type { CanonicalValue } from "../../lib/canonical-values/fingerprint.ts";
import type { LibraryVocabularyLoader } from "../../lib/library-vocabulary/vocabulary-loader.ts";
import type { RuleMessage } from "../../lib/rule-message.ts";

const ownerDescription = (canonicalOwner: CanonicalValuesEntry): string => {
  const routes = canonicalOwner.importRoutes.map((route) => route.specifier).join(", ");
  return `${canonicalOwner.conceptId} ${routes === "" ? `declared in ${canonicalOwner.declarationPath}` : `exported from ${routes}`}`;
};

const catalogOwnerReport = (input: {
  readonly owners: readonly CanonicalValuesEntry[];
  readonly ownershipPolicy: string;
}): RuleMessage => {
  const [onlyOwner] = input.owners;
  return input.owners.length === 1 && onlyOwner !== undefined
    ? {
        messageId: "localFiniteValueSetWithOwner",
        data: { owner: ownerDescription(onlyOwner), ownershipPolicy: input.ownershipPolicy },
      }
    : {
        messageId: "localFiniteValueSetWithOwnerCandidates",
        data: {
          owners: input.owners.map(ownerDescription).join(", "),
          ownershipPolicy: input.ownershipPolicy,
        },
      };
};

const overlappingOwnerReport = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly ownershipPolicy: string;
  readonly values: readonly CanonicalValue[];
}): RuleMessage | null => {
  const overlapping = [
    ...new Set(
      input.values.flatMap(
        (value) => input.catalog.entriesByValue.get(canonicalValueKey(value)) ?? [],
      ),
    ),
  ];
  if (overlapping.length === 0) return null;
  const heldBy = (owner: CanonicalValuesEntry): ReadonlySet<string> =>
    new Set(owner.values.map(canonicalValueKey));
  const supersets = overlapping.filter((owner) =>
    input.values.every((value) => heldBy(owner).has(canonicalValueKey(value))),
  );
  if (supersets.length > 0) {
    return {
      messageId: "localFiniteValueSetSubsetOfOwner",
      data: {
        owners: supersets.map(ownerDescription).join(", "),
        ownershipPolicy: input.ownershipPolicy,
      },
    };
  }
  const sharedValues = input.values.filter((value) =>
    overlapping.some((owner) => heldBy(owner).has(canonicalValueKey(value))),
  );
  return {
    messageId: "localFiniteValueSetOverlapsOwner",
    data: {
      owners: overlapping.map(ownerDescription).join(", "),
      ownershipPolicy: input.ownershipPolicy,
      sharedValues: formatValues(sharedValues),
    },
  };
};

const libraryOwnerReport = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
  readonly filename: string;
  readonly ownershipPolicy: string;
  readonly repositoryRoot: string;
  readonly values: readonly CanonicalValue[];
}): RuleMessage => {
  const libraries = libraryOwnersOf(
    input.loadLibraryVocabulary({
      filename: input.filename,
      repositoryRoot: input.repositoryRoot,
    }),
    input.values,
  );
  const [onlyLibrary] = libraries;
  if (libraries.length === 0) {
    return (
      overlappingOwnerReport(input) ?? {
        messageId: "localFiniteValueSetWithoutOwner",
        data: { ownershipPolicy: input.ownershipPolicy },
      }
    );
  }
  if (libraries.length === 1 && onlyLibrary !== undefined) {
    return {
      messageId: "localFiniteValueSetOwnedByLibraryType",
      data: {
        owner: describeLibraryOwner(onlyLibrary, input.values),
        ownershipPolicy: input.ownershipPolicy,
      },
    };
  }
  return {
    messageId: "localFiniteValueSetOwnedByLibraryTypeCandidates",
    data: {
      owners: libraries.map((library) => describeLibraryOwner(library, input.values)).join(", "),
      ownershipPolicy: input.ownershipPolicy,
    },
  };
};

const preparedReport = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly diagnostic: ReturnType<typeof analyzeLocalFiniteValues>[number];
  readonly filename: string;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
  readonly ownershipPolicy: string;
  readonly repositoryRoot: string;
}): RuleMessage & {
  readonly node: ReturnType<typeof analyzeLocalFiniteValues>[number]["node"];
} => {
  const { diagnostic } = input;
  if (diagnostic.kind === "unregistered-route") {
    return {
      node: diagnostic.node,
      messageId: "unregisteredCanonicalValuesImportRoute",
      data: { name: diagnostic.name, specifier: diagnostic.specifier },
    };
  }
  const report =
    diagnostic.owners.length === 0
      ? libraryOwnerReport({ ...input, values: diagnostic.values })
      : catalogOwnerReport({ owners: diagnostic.owners, ownershipPolicy: input.ownershipPolicy });
  return { node: diagnostic.node, ...report };
};

export const createNoLocalFiniteValueSet = ({
  loadCatalog,
  loadLibraryVocabulary,
}: {
  readonly loadCatalog: CanonicalValuesCatalogLoader;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-local-finite-value-set--use-or-register-canonical-values",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow defining a finite value set inside a file that does not own it, so one place declares the vocabulary and every other place derives from it",
        relatedGuidelines: ["apps/internal-dashboard/content/docs/guidelines/writing-code.md"],
      },
      messages: {
        localFiniteValueSetWithOwner:
          "Defining a finite value set inside a file that does not own it is forbidden. Delete the local values and derive the schema, type, or membership check from {{owner}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetWithOwnerCandidates:
          "Defining a finite value set inside a file that does not own it is forbidden. Delete the local values and derive them from the matching owner among {{owners}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetWithoutOwner:
          "Defining a finite value set without an owner is forbidden. Register the runtime values in the module that owns the concept. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetSubsetOfOwner:
          "Defining part of a declared vocabulary as a new finite value set is forbidden. Derive the subset from {{owners}}, for example with Extract or the schema's extract, instead of spelling the values again. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetOverlapsOwner:
          "Defining a finite value set without an owner is forbidden. {{sharedValues}} already belong to {{owners}}: derive from that owner when this is the same concept, otherwise register these runtime values as a separate concept. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetOwnedByLibraryType:
          "Defining a finite value set that a dependency already owns is forbidden. Delete the local values and derive the type from {{owner}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetOwnedByLibraryTypeCandidates:
          "Defining a finite value set that dependencies already own is forbidden. Delete the local values and derive the type from the matching owner among {{owners}}. Ownership policy: {{ownershipPolicy}}.",
        unregisteredCanonicalValuesImportRoute:
          "Feeding a finite value set from an unregistered repository route is forbidden. `{{name}}` from `{{specifier}}` has neither a registered public export path nor an annotated declaration. Register the owner and import its registered binding.",
      },
      schema: OWNERSHIP_POLICY_SCHEMA,
    },
    create(inspection) {
      const repositoryRoot = findWorkspaceRoot(inspection.cwd);
      if (isOutOfScopeLintSource(inspection.filename, repositoryRoot)) return {};
      const catalog = loadCatalog({ repositoryRoot });
      const ownershipPolicy = ownershipPolicyOf(inspection.options);
      const reports = analyzeLocalFiniteValues({
        catalog,
        filename: inspection.filename,
        repositoryRoot,
        sourceCode: inspection.sourceCode,
      }).map((diagnostic) =>
        preparedReport({
          catalog,
          diagnostic,
          filename: inspection.filename,
          loadLibraryVocabulary,
          ownershipPolicy,
          repositoryRoot,
        }),
      );
      return {
        Program() {
          for (const report of reports) {
            inspection.report({
              node: report.node,
              messageId: report.messageId,
              data: report.data,
            });
          }
        },
      };
    },
  });
