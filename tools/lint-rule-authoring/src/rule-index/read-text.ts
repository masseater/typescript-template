import { readFileSync } from "node:fs";

import { readUnlessMissing } from "@repo/repository-checks";

export const textOrNull = (filePath: string): string | null =>
  readUnlessMissing(() => readFileSync(filePath, "utf8"));
