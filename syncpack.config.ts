import { Array, Record, pipe } from "effect";
import type { RcFile } from "syncpack";

import { requiredStack } from "./lint.config.ts";

const config: RcFile = {
  versionGroups: pipe(
    Record.toEntries(requiredStack),
    Array.map(([label, dependencies]) => ({
      label,
      dependencies: [...dependencies],
      isBanned: true,
    })),
  ),
};

export default config;
