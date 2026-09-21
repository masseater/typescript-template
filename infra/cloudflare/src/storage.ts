import { RemovalPolicy, Stack } from "alchemy";
import { R2 } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { settings } from "./settings.ts";
import { stackName, stackOptions } from "./stacks.ts";

const photosResource = "Photos";

function photoBucketName(prefix: string): string {
  return `${prefix}-photos`;
}

const stack = Stack(
  stackName("storage"),
  stackOptions,
  Effect.gen(function* storage() {
    const config = yield* Effect.orDie(settings);
    const bucket = yield* R2.Bucket(photosResource, {
      name: photoBucketName(config.prefix),
    }).pipe(RemovalPolicy.retain());
    return { photoBucketName: bucket.bucketName };
  }),
);

function photoBucketRef(): Effect.Effect<R2.Bucket> {
  return R2.Bucket.ref(photosResource, { stack: stackName("storage") });
}

export default stack;
export { photoBucketName, photoBucketRef };
