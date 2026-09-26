// @effect-diagnostics-next-line nodeBuiltinImport:off
import { mkdirSync, renameSync, writeFileSync } from "node:fs";

import { Option } from "effect";
import { attempt } from "es-toolkit";

import { path } from "../../../../platform/path.ts";
import {
  CACHE_FORMAT_VERSION,
  cacheIntegrity,
  decodeCachedCatalog,
  type CachedCatalog,
} from "./catalog-cache-validation.ts";
import { readJsonFile } from "./read-json-file.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";

export { cacheInputFingerprint } from "./catalog-cache-fingerprint.ts";

const CACHE_FILE_SEGMENTS: readonly string[] = [
  "node_modules",
  ".cache",
  "mst-dont-review-it",
  "canonical-values.json",
];

export const cacheFilePath = (repositoryRoot: string): string =>
  path.join(repositoryRoot, ...CACHE_FILE_SEGMENTS);

const usableCacheAt = (filePath: string): unknown => {
  const [unreadableCache, cached] = attempt(() => readJsonFile(filePath));
  return unreadableCache === null ? cached : null;
};

export const readCachedEntries = (
  repositoryRoot: string,
  fingerprint: string,
): readonly CanonicalValuesEntry[] | null => {
  return decodeCachedCatalog(usableCacheAt(cacheFilePath(repositoryRoot))).pipe(
    Option.filter((cached) => cached.fingerprint === fingerprint),
    Option.match({ onNone: () => null, onSome: (cached) => cached.entries }),
  );
};

export const writeCachedEntries = (
  repositoryRoot: string,
  {
    fingerprint,
    entries,
  }: { readonly fingerprint: string; readonly entries: readonly CanonicalValuesEntry[] },
): void => {
  const filePath = cacheFilePath(repositoryRoot);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  const cacheDocument: CachedCatalog = {
    version: CACHE_FORMAT_VERSION,
    fingerprint,
    entries,
    integrity: cacheIntegrity({ fingerprint, entries }),
  };
  const [unwritableCache] = attempt(() => {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(temporaryPath, JSON.stringify(cacheDocument), "utf8");
    renameSync(temporaryPath, filePath);
  });
  if (unwritableCache !== null) return;
};
