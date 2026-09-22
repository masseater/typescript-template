import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SharedTaskCacheUnset,
  cleanSharedTaskCache,
  readSharedTaskCache,
  sharedTaskCacheEnv,
} from "./shared-task-cache.ts";

describe("shared task cache", () => {
  it("rejects a missing shared cache path", () => {
    expect.hasAssertions();
    expect(() => readSharedTaskCache({})).toThrow(SharedTaskCacheUnset);
    expect(() => readSharedTaskCache({ [sharedTaskCacheEnv]: "   " })).toThrow(
      SharedTaskCacheUnset,
    );
  });

  it("reads the configured shared cache path", () => {
    expect.hasAssertions();
    expect(readSharedTaskCache({ [sharedTaskCacheEnv]: "/tmp/task-cache" })).toBe(
      "/tmp/task-cache",
    );
  });

  it("replaces an existing cache directory with an empty one", async () => {
    expect.hasAssertions();
    const root = await mkdtemp(path.join(tmpdir(), "shared-task-cache-"));
    const cache = path.join(root, "cache");
    await mkdir(cache);
    await writeFile(path.join(cache, "stale"), "old");
    try {
      const result = await cleanSharedTaskCache(cache, "run-1");
      expect(result).toStrictEqual({
        event: "quality.shared_task_cache_cleaned",
        ok: true,
        path: cache,
      });
      await expect(readFile(path.join(cache, "stale"), "utf8")).rejects.toThrow(
        /ENOENT|no such file/u,
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("creates the cache directory when it is missing", async () => {
    expect.hasAssertions();
    const root = await mkdtemp(path.join(tmpdir(), "shared-task-cache-"));
    const cache = path.join(root, "cache");
    try {
      await cleanSharedTaskCache(cache, "run-2");
      await writeFile(path.join(cache, "ready"), "ok");
      await expect(readFile(path.join(cache, "ready"), "utf8")).resolves.toBe("ok");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
