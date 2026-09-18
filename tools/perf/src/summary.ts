import { Option, Schema } from "effect";
import type { Attributes } from "./protocol.ts";

const CacheMiss = Schema.Struct({ Miss: Schema.Unknown });
const SpawnedCacheStatus = Schema.Union([Schema.Literal("Disabled"), CacheMiss]);
const SpawnedResult = Schema.Struct({
  Spawned: Schema.Struct({ cache_status: SpawnedCacheStatus, outcome: Schema.Unknown }),
});
const CacheHitResult = Schema.Struct({
  CacheHit: Schema.Struct({ saved_duration_ms: Schema.Number }),
});
const TaskSummary = Schema.Struct({
  command: Schema.String,
  cwd: Schema.String,
  package_name: Schema.String,
  result: Schema.Unknown,
  task_name: Schema.String,
});
const RunSummary = Schema.Struct({ tasks: Schema.Array(TaskSummary) });
const ModifiedPath = Schema.NullOr(Schema.String);
const SuccessDetails = Schema.Struct({
  infra_error: Schema.optionalKey(Schema.Unknown),
  input_modified_path: Schema.optionalKey(ModifiedPath),
  tool_disabled_cache: Schema.optionalKey(Schema.Boolean),
  tracking_incomplete: Schema.optionalKey(Schema.Boolean),
});
const SuccessOutcome = Schema.Struct({ Success: SuccessDetails });

type Task = typeof TaskSummary.Type;

function variantName(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return typeof value === "object" && value !== null ? (Object.keys(value)[0] ?? "") : "";
}

function skippedReason(details: typeof SuccessDetails.Type): string | undefined {
  const modified = details.input_modified_path;
  const infraError = details.infra_error;
  return [
    typeof modified === "string" ? `input_modified:${modified}` : undefined,
    details.tool_disabled_cache === true ? "tool_disabled_cache" : undefined,
    details.tracking_incomplete === true ? "tracking_incomplete" : undefined,
    infraError === undefined || infraError === null
      ? undefined
      : `infra_error:${variantName(infraError)}`,
  ].find((reason) => reason !== undefined);
}

function cacheUpdateSkipped(outcome: unknown): string | undefined {
  return Option.getOrUndefined(
    Option.map(Schema.decodeUnknownOption(SuccessOutcome)(outcome), ({ Success }) =>
      skippedReason(Success),
    ),
  );
}

function taskAttributes(task: Task): Attributes {
  const identity = {
    "vp.task": `${task.package_name}#${task.task_name}`,
    "vp.task.command": task.command,
    "vp.task.cwd": task.cwd,
  };
  const hit = Schema.decodeUnknownOption(CacheHitResult)(task.result);
  if (Option.isSome(hit)) {
    return {
      ...identity,
      "vp.task.cache": "hit",
      "vp.task.cache.saved_ms": hit.value.CacheHit.saved_duration_ms,
    };
  }
  const spawned = Schema.decodeUnknownOption(SpawnedResult)(task.result);
  if (Option.isNone(spawned)) {
    return { ...identity, "vp.task.cache": variantName(task.result) };
  }
  const { cache_status: status, outcome } = spawned.value.Spawned;
  return {
    ...identity,
    "vp.task.cache": status === "Disabled" ? "disabled" : "miss",
    "vp.task.cache.miss_reason": status === "Disabled" ? undefined : variantName(status.Miss),
    "vp.task.cache.update_skipped": cacheUpdateSkipped(outcome),
    "vp.task.outcome": variantName(outcome),
  };
}

function decodeSummary(json: unknown): Option.Option<readonly Task[]> {
  return Option.map(Schema.decodeUnknownOption(RunSummary)(json), (summary) => summary.tasks);
}

export { decodeSummary, taskAttributes };
export type { Task };
