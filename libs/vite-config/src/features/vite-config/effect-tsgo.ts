import { effectTsgoNoEmit, effectTypecheckInputs } from "@repo/config";

import type { UserConfig } from "vite-plus";

const effectDiagnostics = {
  "check:effect": {
    command: effectTsgoNoEmit("tsconfig.json"),
    input: [...effectTypecheckInputs],
  },
} satisfies NonNullable<UserConfig["run"]>["tasks"];

const awaitingEffectDiagnostics = {
  "check:effect": {
    command: "check-effect-typecheck",
    input: [
      ...effectTypecheckInputs,
      { base: "workspace", pattern: "**/effect-typecheck-baseline.json" },
    ],
  },
} satisfies NonNullable<UserConfig["run"]>["tasks"];

export { awaitingEffectDiagnostics, effectDiagnostics, effectTsgoNoEmit };
