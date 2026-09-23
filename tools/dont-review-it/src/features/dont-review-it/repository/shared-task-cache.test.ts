import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  SharedTaskCacheUnset,
  cleanSharedTaskCache,
  readSharedTaskCache,
  sharedTaskCacheEnv,
} from "./shared-task-cache.ts";

const readUnder = (env: Record<string, string>) =>
  readSharedTaskCache.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
    Effect.flip,
  );

const cacheRoot = Effect.gen(function* cacheRoot() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "shared-task-cache-" });
  return paths.join(root, "cache");
});

layer(NodeServices.layer)("shared task cache", (it) => {
  describe("a missing shared cache path", () => {
    it.effect("is refused", () =>
      Effect.gen(function* program() {
        expect(yield* readUnder({})).toBeInstanceOf(SharedTaskCacheUnset);
        expect(yield* readUnder({ [sharedTaskCacheEnv]: "   " })).toBeInstanceOf(
          SharedTaskCacheUnset,
        );
      }),
    );
  });

  describe("a configured shared cache path", () => {
    it.effect("is read", () =>
      Effect.gen(function* program() {
        const configured = yield* readSharedTaskCache.pipe(
          Effect.provide(
            ConfigProvider.layer(
              ConfigProvider.fromEnv({ env: { [sharedTaskCacheEnv]: "/tmp/task-cache" } }),
            ),
          ),
        );
        expect(configured).toBe("/tmp/task-cache");
      }),
    );
  });

  describe("an existing cache directory", () => {
    it.effect("is replaced with an empty one", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const cache = yield* cacheRoot;
        yield* filesystem.makeDirectory(cache);
        yield* filesystem.writeFileString(paths.join(cache, "stale"), "old");
        const result = yield* cleanSharedTaskCache(cache, "run-1");
        expect(result).toStrictEqual({
          event: "quality.shared_task_cache_cleaned",
          ok: true,
          path: cache,
        });
        expect(yield* filesystem.exists(paths.join(cache, "stale"))).toBe(false);
      }),
    );
  });

  describe("a missing cache directory", () => {
    it.effect("is created", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const cache = yield* cacheRoot;
        yield* cleanSharedTaskCache(cache, "run-2");
        yield* filesystem.writeFileString(paths.join(cache, "ready"), "ok");
        expect(yield* filesystem.readFileString(paths.join(cache, "ready"))).toBe("ok");
      }),
    );
  });
});
