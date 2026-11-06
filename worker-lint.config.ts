import {
  restrictedImports as untracedImports,
  restrictedProperties as untracedProperties,
} from "@r_masseater/workers-tracing/oxlint";

import { restrictedImports } from "./lint.config.ts";

const workerRules: Readonly<Record<string, ["error", ...unknown[]]>> = {
  "eslint/no-restricted-imports": [
    "error",
    { ...restrictedImports, paths: [...restrictedImports.paths, ...untracedImports] },
  ],
  "eslint/no-restricted-properties": ["error", ...untracedProperties],
};

export { workerRules };
