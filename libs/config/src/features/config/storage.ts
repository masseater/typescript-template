import { Effect, Schema } from "effect";

import { bindingWith, decode } from "./environment.ts";

import type { KVNamespace, R2Bucket } from "@cloudflare/workers-types";

const fileBucketBinding = "FILES";
const cacheNamespaceBinding = "CACHE";

const localFileBucket = {
  binding: fileBucketBinding,
  bucket_name: "template-files",
} as const;

const localCacheNamespace = {
  binding: cacheNamespaceBinding,
  id: "00000000-0000-0000-0000-000000000002",
} as const;

const StorageBindings = Schema.Struct({
  [cacheNamespaceBinding]: bindingWith<KVNamespace>("KVNamespace", ["get", "put", "delete"]),
  [fileBucketBinding]: bindingWith<R2Bucket>("R2Bucket", ["get", "put", "delete"]),
});

const OptionalStorageBindings = Schema.Struct({
  [cacheNamespaceBinding]: Schema.optionalKey(
    bindingWith<KVNamespace>("KVNamespace", ["get", "put", "delete"]),
  ),
  [fileBucketBinding]: Schema.optionalKey(
    bindingWith<R2Bucket>("R2Bucket", ["get", "put", "delete"]),
  ),
});

const readStorage = Effect.fn("readStorage")(function* readStorage(input: unknown) {
  const bindings = yield* decode(StorageBindings, input);
  return {
    cache: bindings[cacheNamespaceBinding],
    files: bindings[fileBucketBinding],
  };
});

const readOptionalStorage = Effect.fn("readOptionalStorage")(function* readOptionalStorage(
  input: unknown,
) {
  const bindings = yield* decode(OptionalStorageBindings, input);
  return {
    cache: bindings[cacheNamespaceBinding],
    files: bindings[fileBucketBinding],
  };
});

export {
  cacheNamespaceBinding,
  fileBucketBinding,
  localCacheNamespace,
  localFileBucket,
  readOptionalStorage,
  readStorage,
};
