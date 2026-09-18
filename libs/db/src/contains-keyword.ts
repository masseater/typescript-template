import { sql } from "drizzle-orm";

import type { Column, SQL } from "drizzle-orm";

function containsKeyword(column: Column, keyword: string): SQL {
  const pattern = `%${keyword.replaceAll(/[\\%_]/gu, String.raw`\$&`)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

export { containsKeyword };
