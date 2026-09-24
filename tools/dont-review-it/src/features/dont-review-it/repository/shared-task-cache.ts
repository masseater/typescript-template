import { Config, Effect, FileSystem, Schema, type PlatformError } from "effect";

import { pathExists } from "../platform/file-system.ts";

const sharedTaskCacheEnv = "SHARED_TASK_CACHE";

class SharedTaskCacheUnset extends Schema.TaggedError<SharedTaskCacheUnset>()(
  "SharedTaskCacheUnset",
  {},
) {}

const readSharedTaskCache: Effect.Effect<string, SharedTaskCacheUnset> = Config.String(
  sharedTaskCacheEnv,
).pipe(
  Effect.mapError(() => new SharedTaskCacheUnset()),
  Effect.filterOrFail(
    (value) => value.trim() !== "",
    () => new SharedTaskCacheUnset(),
  ),
);

interface SharedTaskCacheCleaned {
  readonly event: "quality.shared_task_cache_cleaned";
  readonly ok: true;
  readonly path: string;
}

const cleanSharedTaskCache = (
  sharedTaskCache: string,
  runId: string,
): Effect.Effect<SharedTaskCacheCleaned, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* cleanSharedTaskCache() {
    const filesystem = yield* FileSystem.FileSystem;
    const retired = `${sharedTaskCache}.retired.${runId}`;
    const present = yield* pathExists(sharedTaskCache);
    if (present) {
      yield* filesystem.rename(sharedTaskCache, retired);
    }
    yield* filesystem.makeDirectory(sharedTaskCache, { recursive: true });
    if (present) {
      yield* filesystem.remove(retired, { force: true, recursive: true });
    }
    return { event: "quality.shared_task_cache_cleaned", ok: true, path: sharedTaskCache } as const;
  });

export { SharedTaskCacheUnset, cleanSharedTaskCache, readSharedTaskCache, sharedTaskCacheEnv };
export type { SharedTaskCacheCleaned };
