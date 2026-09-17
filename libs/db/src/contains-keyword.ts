import type { Column, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function containsKeyword(column: Column, keyword: string): SQL {
  const pattern = `%${keyword.replaceAll(/[\\%_]/gu, String.raw`\$&`)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

export { containsKeyword };
