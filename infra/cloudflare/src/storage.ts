import { RemovalPolicy, Stack } from "alchemy";
import { KV, R2 } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { settings } from "./settings.ts";
import { stackName, stackOptions } from "./stacks.ts";

const filesResource = "Files";
const cacheResource = "Cache";

function fileBucketName(prefix: string): string {
  return `${prefix}-files`;
}

function cacheNamespaceTitle(prefix: string): string {
  return `${prefix}-cache`;
}

const stack = Stack(
  stackName("storage"),
  stackOptions,
  Effect.gen(function* storage() {
    const config = yield* Effect.orDie(settings);
    const files = yield* R2.Bucket(filesResource, {
      name: fileBucketName(config.prefix),
    }).pipe(RemovalPolicy.retain());
    const cache = yield* KV.Namespace(cacheResource, {
      title: cacheNamespaceTitle(config.prefix),
    }).pipe(RemovalPolicy.retain());
    return {
      cacheNamespaceId: cache.namespaceId,
      fileBucketName: files.bucketName,
    };
  }),
);

function fileBucketRef(): Effect.Effect<R2.Bucket> {
  return R2.Bucket.ref(filesResource, { stack: stackName("storage") });
}

function cacheNamespaceRef(): Effect.Effect<KV.Namespace> {
  return KV.Namespace.ref(cacheResource, { stack: stackName("storage") });
}

export default stack;
export { cacheNamespaceRef, cacheNamespaceTitle, fileBucketName, fileBucketRef };
