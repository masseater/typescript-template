import { readFileSync } from "node:fs";

import { readUnlessMissing } from "../../repository-checks/index.ts";

export const textOrNull = (filePath: string): string | null =>
  readUnlessMissing(() => readFileSync(filePath, "utf8"));
