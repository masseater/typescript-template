#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { Cause, Console, Effect } from "effect";

import {
  SharedTaskCacheUnset,
  cleanSharedTaskCache,
  readSharedTaskCache,
  sharedTaskCacheEnv,
} from "./shared-task-cache.ts";

const uncheckedRecord = (
  detail: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  return { event: "quality.shared_task_cache_clean_failed", ok: false, ...detail };
};

runCli(
  Effect.gen(function* () {
    const sharedTaskCache = readSharedTaskCache();
    const result = yield* Effect.tryPromise({
      try: () =>
        cleanSharedTaskCache(sharedTaskCache, process.env.GITHUB_RUN_ID ?? String(process.pid)),
      catch: (cause) => cause,
    });
    yield* Console.log(JSON.stringify(result));
  }),
  (cause) => {
    const defect: unknown = Cause.squash(cause);
    if (defect instanceof SharedTaskCacheUnset) {
      return uncheckedRecord({
        reason: "shared-task-cache-unset",
        required: sharedTaskCacheEnv,
      });
    }
    return uncheckedRecord({
      error: defect instanceof Error ? defect.name : typeof defect,
      reason: "shared-task-cache-clean-failed",
    });
  },
);
