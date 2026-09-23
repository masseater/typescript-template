import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { describe, expect, test } from "vite-plus/test";

import { erDiagram } from "./er-diagram.ts";

const owner = sqliteTable(
  "owner",
  {
    email: text("email").notNull(),
    id: text("id").primaryKey(),
    nickname: text("nickname"),
  },
  (table) => [
    uniqueIndex("owner_email_unique").on(table.email),
    uniqueIndex("owner_nickname_lower_unique").on(table.nickname, sql`lower(${table.nickname})`),
  ],
);

const pet = sqliteTable(
  "pet",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => owner.id),
    sitterId: text("sitter_id").references(() => owner.id),
  },
  (table) => [index("pet_owner_id_idx").on(table.ownerId)],
);

const licence = sqliteTable("licence", {
  number: integer("number").notNull(),
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => owner.id),
});

const friendship = sqliteTable(
  "friendship",
  {
    fromId: text("from_id")
      .notNull()
      .references(() => owner.id),
    toId: text("to_id")
      .notNull()
      .references(() => owner.id),
  },
  (table) => [primaryKey({ columns: [table.fromId, table.toId] })],
);

describe("erDiagram", () => {
  const it = test
    .extend("diagram", () => erDiagram({ pet, owner, licence, friendship }).split("\n"))
    .extend("outline", ({ diagram }) =>
      diagram.filter((line) => !line.startsWith("    ") && !line.includes("--")),
    )
    .extend("columnLines", ({ diagram }) => diagram.filter((line) => line.startsWith("    ")))
    .extend("relationships", ({ diagram }) => diagram.filter((line) => line.includes("--")));

  it("opens a Mermaid ER diagram whose entities follow the table names in order", ({ outline }) => {
    expect(outline).toStrictEqual([
      "erDiagram",
      "  friendship {",
      "  }",
      "  licence {",
      "  }",
      "  owner {",
      "  }",
      "  pet {",
      "  }",
    ]);
  });

  it("marks primary, foreign and unique keys and the columns that accept null", ({
    columnLines,
  }) => {
    expect(columnLines).toStrictEqual([
      "    text from_id PK, FK",
      "    text to_id PK, FK",
      "    integer number",
      "    text owner_id PK, FK",
      "    text email UK",
      "    text id PK",
      '    text nickname "nullable"',
      "    text id PK",
      "    text owner_id FK",
      '    text sitter_id FK "nullable"',
    ]);
  });

  it("draws each foreign key from the referenced table with the cardinality its columns allow", ({
    relationships,
  }) => {
    expect(relationships).toStrictEqual([
      '  owner ||--o{ friendship : "from_id"',
      '  owner ||--o{ friendship : "to_id"',
      '  owner ||--o| licence : "owner_id"',
      '  owner ||--o{ pet : "owner_id"',
      '  owner |o--o{ pet : "sitter_id"',
    ]);
  });
});
