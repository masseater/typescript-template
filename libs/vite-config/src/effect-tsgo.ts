import { effectTsgoNoEmit, effectTypecheckInputs } from "@repo/config/effect-typecheck";

import type { UserConfig } from "vite-plus";

const effectDiagnostics = {
  "check:effect": {
    command: effectTsgoNoEmit("tsconfig.json"),
    input: [...effectTypecheckInputs],
  },
} satisfies NonNullable<UserConfig["run"]>["tasks"];

export { effectDiagnostics, effectTsgoNoEmit, effectTypecheckInputs };
