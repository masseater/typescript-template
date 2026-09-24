// @effect-diagnostics-next-line nodeBuiltinImport:off
import { closeSync, mkdirSync, openSync } from "node:fs";

import { waitForLockSync } from "fs-native-extensions";

import { measureStage } from "../../../../lint-rule-authoring/index.ts";
import { path } from "../../../../platform/path.ts";
import { cacheFilePath } from "./catalog-cache.ts";

export const underCatalogBuildLock = <Built>(repositoryRoot: string, build: () => Built): Built => {
  const lockPath = `${cacheFilePath(repositoryRoot)}.lock`;
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const descriptor = openSync(lockPath, "a");
  try {
    measureStage("canonical.lock", () => {
      waitForLockSync(descriptor);
    });
    return build();
  } finally {
    closeSync(descriptor);
  }
};
