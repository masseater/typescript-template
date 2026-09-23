#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { runCli } from "@repo/cli";
import { Cause, Config, Console, Effect, Schema } from "effect";

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
  Effect.gen(function* cleanSharedTaskCacheCommand() {
    const sharedTaskCache = yield* readSharedTaskCache;
    const runId = yield* Config.String("GITHUB_RUN_ID").pipe(
      Config.withDefault(String(process.pid)),
    );
    const result = yield* cleanSharedTaskCache(sharedTaskCache, runId);
    yield* Console.log(yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(result));
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => {
    const defect: unknown = Cause.squash(cause);
    if (Schema.is(SharedTaskCacheUnset)(defect)) {
      return uncheckedRecord({
        reason: "shared-task-cache-unset",
        required: sharedTaskCacheEnv,
      });
    }
    return uncheckedRecord({
      cause: Cause.pretty(cause),
      error: defect instanceof Error ? defect.name : typeof defect,
      reason: "shared-task-cache-clean-failed",
    });
  },
);
