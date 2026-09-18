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

const reachablePackagesOf = memoize((packageDirectory: string): ReadonlySet<string> => {
  const manifest = readJsonFile(join(packageDirectory, MANIFEST_FILE_NAME));
  if (typeof manifest !== "object" || manifest === null) return new Set();
  const ownName = Reflect.get(manifest, "name");
  const dependencyNames = DEPENDENCY_FIELDS.flatMap((field) => {
    const declared: unknown = Reflect.get(manifest, field);
    return typeof declared === "object" && declared !== null ? Object.keys(declared) : [];
  });
  return new Set([...(typeof ownName === "string" ? [ownName] : []), ...dependencyNames]);
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
  return (owner) => owner.packageName === null || reachable.has(owner.packageName);
};
