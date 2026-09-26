import { groupBy, uniq } from "es-toolkit";

import { canonicalValueKey } from "./fingerprint.ts";

import type { GitSourceScope } from "../git-ignored-source.ts";
import type {
  CanonicalValuesEntry as CanonicalValuesEntrySchema,
  CanonicalValuesImportRoute as CanonicalValuesImportRouteSchema,
} from "./catalog-cache-validation.ts";

export { canonicalValueKey };

export type CanonicalValuesImportRoute = typeof CanonicalValuesImportRouteSchema.Type;

export type CanonicalValuesEntry = typeof CanonicalValuesEntrySchema.Type;

export type CanonicalValuesCatalog = {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly entriesByFingerprint: ReadonlyMap<string, readonly CanonicalValuesEntry[]>;
  readonly entriesByValue: ReadonlyMap<string, readonly CanonicalValuesEntry[]>;
  readonly packageNames: ReadonlySet<string>;
  readonly sourceScope: GitSourceScope;
};

const ALL_SOURCES: GitSourceScope = { isIgnored: () => false };

const entriesByKey = (
  declarations: readonly CanonicalValuesEntry[],
  keysOf: (declaration: CanonicalValuesEntry) => readonly string[],
): ReadonlyMap<string, readonly CanonicalValuesEntry[]> => {
  const keyed = declarations.flatMap((declaration) =>
    keysOf(declaration).map((groupingKey) => ({ groupingKey, declaration })),
  );

  return new Map(
    Object.entries(groupBy(keyed, (held) => held.groupingKey)).map(([groupingKey, grouped]) => [
      groupingKey,
      uniq(grouped.map((held) => held.declaration)),
    ]),
  );
};

export const buildCatalog = (
  declarations: readonly CanonicalValuesEntry[],
  catalogConfiguration: {
    readonly packageNames?: readonly string[];
    readonly sourceScope?: GitSourceScope;
  } = {},
): CanonicalValuesCatalog => ({
  entries: declarations,
  entriesByFingerprint: entriesByKey(declarations, (declaration) => [declaration.fingerprint]),
  entriesByValue: entriesByKey(declarations, (declaration) =>
    declaration.values.map(canonicalValueKey),
  ),
  packageNames: new Set(
    catalogConfiguration.packageNames ??
      declarations.flatMap((declaration) =>
        declaration.packageName === null ? [] : [declaration.packageName],
      ),
  ),
  sourceScope: catalogConfiguration.sourceScope ?? ALL_SOURCES,
});
