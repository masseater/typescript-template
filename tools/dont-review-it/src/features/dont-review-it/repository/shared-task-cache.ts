import { access, mkdir, rename, rm } from "node:fs/promises";

const sharedTaskCacheEnv = "SHARED_TASK_CACHE";

class SharedTaskCacheUnset extends Error {
  override readonly name = "SharedTaskCacheUnset";
}

const readSharedTaskCache = (env: NodeJS.ProcessEnv = process.env): string => {
  const value = env[sharedTaskCacheEnv];
  if (value === undefined || value.trim() === "") {
    throw new SharedTaskCacheUnset();
  }
  return value;
};

const cleanSharedTaskCache = async (
  sharedTaskCache: string,
  runId: string,
): Promise<{
  readonly event: "quality.shared_task_cache_cleaned";
  readonly ok: true;
  readonly path: string;
}> => {
  const retired = `${sharedTaskCache}.retired.${runId}`;
  let present = false;
  try {
    await access(sharedTaskCache);
    present = true;
  } catch {
    present = false;
  }
  if (present) {
    await rename(sharedTaskCache, retired);
  }
  await mkdir(sharedTaskCache, { recursive: true });
  if (present) {
    await rm(retired, { force: true, recursive: true });
  }
  return { event: "quality.shared_task_cache_cleaned", ok: true, path: sharedTaskCache };
};

export { SharedTaskCacheUnset, cleanSharedTaskCache, readSharedTaskCache, sharedTaskCacheEnv };
