import { waitForLockSync } from "fs-native-extensions";

import { measureStage } from "../../../../lint-rule-authoring/index.ts";
import { path } from "../../../../platform/path.ts";
import {
  closeDescriptor,
  createDirectoryTree,
  openForAppending,
} from "../../../../platform/synchronous-host.ts";
import { cacheFilePath } from "./catalog-cache.ts";

export const underCatalogBuildLock = <Built>(repositoryRoot: string, build: () => Built): Built => {
  const lockPath = `${cacheFilePath(repositoryRoot)}.lock`;
  createDirectoryTree(path.dirname(lockPath));
  const descriptor = openForAppending(lockPath);
  try {
    measureStage("canonical.lock", () => {
      waitForLockSync(descriptor);
    });
    return build();
  } finally {
    closeDescriptor(descriptor);
  }
};
