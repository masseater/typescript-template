import { dirname, join } from "node:path";

import { memoize } from "es-toolkit";

import { MANIFEST_FILE_NAME } from "./package-manifest.ts";
import { readJsonFile } from "./read-json-file.ts";
import { nearestPackageDirectory } from "./source-files.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const manifestAt = memoize((packageDirectory: string): object | null => {
  const manifest = readJsonFile(join(packageDirectory, MANIFEST_FILE_NAME));
  return typeof manifest === "object" && manifest !== null ? manifest : null;
});

const packageNameOf = (packageDirectory: string): string | null => {
  const declaredName: unknown = Reflect.get(manifestAt(packageDirectory) ?? {}, "name");
  return typeof declaredName === "string" ? declaredName : null;
};

const reachablePackagesOf = memoize((packageDirectory: string): ReadonlySet<string> => {
  const manifest = manifestAt(packageDirectory) ?? {};
  return new Set(
    DEPENDENCY_FIELDS.flatMap((field) => {
      const declared: unknown = Reflect.get(manifest, field);
      return typeof declared === "object" && declared !== null ? Object.keys(declared) : [];
    }),
  );
});

export const ownersVisibleFrom = (consumer: {
  readonly filename: string;
  readonly repositoryRoot: string;
}): ((owner: CanonicalValuesEntry) => boolean) => {
  const packageDirectory = nearestPackageDirectory(
    dirname(consumer.filename),
    consumer.repositoryRoot,
  );
  const reachable =
    packageDirectory === null ? new Set<string>() : reachablePackagesOf(packageDirectory);
  const ownName = packageDirectory === null ? null : packageNameOf(packageDirectory);
  return (owner) =>
    owner.packageName === null ||
    owner.packageName === ownName ||
    (reachable.has(owner.packageName) && owner.importRoutes.length > 0);
};
