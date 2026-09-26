import { workerPackage } from "@repo/vite-config";

import type { UserConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const monitorWorkerVite = (
  packageRoot: string,
): {
  readonly pack: PackUserConfig;
  readonly run: NonNullable<UserConfig["run"]>;
} => {
  const { pack, run } = workerPackage(packageRoot, ["effect", "@repo/monitor"]);
  return { pack: { ...pack, dts: false }, run };
};

export { monitorWorkerVite };
