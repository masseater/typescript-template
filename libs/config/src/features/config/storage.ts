import { Effect, Schema } from "effect";

import { bindingWith, decode } from "./environment.ts";

import type { KVNamespace, R2Bucket } from "@cloudflare/workers-types";

const fileBucketBinding = "FILES";
const localFileBucket = {
  binding: fileBucketBinding,
  bucket_name: "template-files",
} as const;

const cacheNamespaceBinding = "CACHE";
const localCacheNamespace = {
  binding: cacheNamespaceBinding,
  id: "00000000-0000-0000-0000-000000000002",
} as const;

const StorageBindings = Schema.Struct({
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

export {
  cacheNamespaceBinding,
  fileBucketBinding,
  localCacheNamespace,
  localFileBucket,
  readStorage,
};
