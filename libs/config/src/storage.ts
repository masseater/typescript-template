import { Effect, Schema } from "effect";

import { bindingWith, decode } from "./environment.ts";

import type { R2Bucket } from "@cloudflare/workers-types";

const photoBucketBinding = "PHOTOS";

const localPhotoBucket = {
  binding: photoBucketBinding,
  bucket_name: "template-photos",
} as const;

const StorageBindings = Schema.Struct({
  [photoBucketBinding]: Schema.optionalKey(
    bindingWith<R2Bucket>("R2Bucket", ["get", "put", "delete"]),
  ),
});

const readStorage = Effect.fn("readStorage")(function* readStorage(input: unknown) {
  const bindings = yield* decode(StorageBindings, input);
  return bindings[photoBucketBinding];
});

export { localPhotoBucket, photoBucketBinding, readStorage };
