import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vite-plus/test";

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
  const diagram = erDiagram({ pet, owner, licence, friendship }).split("\n");

  it("opens a Mermaid ER diagram whose entities follow the table names in order", () => {
    expect(diagram.filter((line) => line.endsWith("{"))).toStrictEqual([
      "  friendship {",
      "  licence {",
      "  owner {",
      "  pet {",
    ]);
    expect(diagram[0]).toBe("erDiagram");
  });

  it("marks primary, foreign and unique keys and the columns that accept null", () => {
    expect(diagram).toStrictEqual(
      expect.arrayContaining([
        "    text email UK",
        "    text id PK",
        '    text nickname "nullable"',
        "    text owner_id FK",
        '    text sitter_id FK "nullable"',
        "    text from_id PK, FK",
        "    text owner_id PK, FK",
      ]),
    );
  });

  it("draws each foreign key from the referenced table with the cardinality its columns allow", () => {
    expect(diagram.filter((line) => line.includes("--"))).toStrictEqual([
      '  owner ||--o{ friendship : "from_id"',
      '  owner ||--o{ friendship : "to_id"',
      '  owner ||--o| licence : "owner_id"',
      '  owner ||--o{ pet : "owner_id"',
      '  owner |o--o{ pet : "sitter_id"',
    ]);
  });
});
