// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createHash } from "node:crypto";

import { Option, Schema } from "effect";

import { path } from "../../../../platform/path.ts";
import { canonicalValueKey, fingerprintValues } from "./fingerprint.ts";

export const CACHE_FORMAT_VERSION = 5;

const NonEmptyText = Schema.String.check(Schema.isMinLength(1));

const Offset = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const staysWithinRepository = (filePath: string): boolean =>
  !path.isAbsolute(filePath) &&
  !/^[A-Za-z]:\//u.test(filePath) &&
  filePath !== ".." &&
  !filePath.startsWith("../");

const ResolvedSourcePath = NonEmptyText.check(
  Schema.makeFilter(
    (candidate: string) =>
      (candidate !== "." &&
        !candidate.includes("\0") &&
        !candidate.includes("\\") &&
        path.normalize(candidate) === candidate &&
        staysWithinRepository(candidate)) ||
      "Expected a normalized path inside the repository",
  ),
);

const distinctBy =
  <Item>(keyOf: (item: Item) => string) =>
  (items: readonly Item[]): boolean | string =>
    new Set(items.map(keyOf)).size === items.length || "Expected distinct items";

export const CanonicalValuesImportRoute = Schema.Struct({
  exportName: NonEmptyText,
  resolvedSourcePaths: Schema.Array(ResolvedSourcePath).check(
    Schema.isMinLength(1),
    Schema.makeFilter(distinctBy((sourcePath: string) => sourcePath)),
  ),
  specifier: NonEmptyText,
});

const CanonicalValue = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]);

export const CanonicalValuesEntry = Schema.Struct({
  annotationStart: Offset,
  binding: NonEmptyText,
  bindingStart: Offset,
  conceptId: Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/u)),
  declarationEnd: Offset,
  declarationPath: NonEmptyText,
  declarationStart: Offset,
  importRoutes: Schema.Array(CanonicalValuesImportRoute),
  packageName: Schema.NullOr(NonEmptyText),
  values: Schema.Array(CanonicalValue).check(Schema.makeFilter(distinctBy(canonicalValueKey))),
  fingerprint: Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/u)),
}).check(
  Schema.makeFilter(
    (entry) =>
      (entry.annotationStart < entry.declarationStart &&
        entry.bindingStart >= entry.declarationStart &&
        entry.bindingStart < entry.declarationEnd) ||
      "Expected the annotation, declaration and binding offsets in source order",
  ),
  Schema.makeFilter(
    (entry) =>
      entry.fingerprint === fingerprintValues(entry.values) ||
      "Expected the fingerprint of the values",
  ),
);

export type FingerprintedEntries = {
  readonly fingerprint: string;
  readonly entries: readonly unknown[];
};

export const cacheIntegrity = ({ fingerprint, entries }: FingerprintedEntries): string =>
  createHash("sha256")
    .update(JSON.stringify({ version: CACHE_FORMAT_VERSION, fingerprint, entries }))
    .digest("hex");

const SealedCatalog = Schema.Struct({
  entries: Schema.Array(Schema.Unknown),
  fingerprint: Schema.String,
  integrity: Schema.String,
  version: Schema.Literal(CACHE_FORMAT_VERSION),
}).check(
  Schema.makeFilter(
    (sealed) =>
      sealed.integrity === cacheIntegrity(sealed) ||
      "Expected the integrity of the fingerprint and entries",
  ),
);

const CachedEntries = Schema.Array(CanonicalValuesEntry);

export type CachedCatalog = Omit<typeof SealedCatalog.Type, "entries"> & {
  readonly entries: typeof CachedEntries.Type;
};

export const decodeCachedCatalog = (candidate: unknown): Option.Option<CachedCatalog> =>
  Schema.decodeUnknownOption(SealedCatalog)(candidate).pipe(
    Option.flatMap((sealed) =>
      Schema.decodeUnknownOption(CachedEntries)(sealed.entries).pipe(
        Option.map((entries) => ({ ...sealed, entries })),
      ),
    ),
  );
