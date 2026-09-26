import { erDiagram, schema } from "@repo/db";
import { describe, expect, it } from "vite-plus/test";

const schemaDocument = [
  "---",
  "title: 実装のスキーマ",
  "description: libs/db の Drizzle スキーマから生成した、D1 の表と外部キーの ER 図",
  "---",
  "",
  "`libs/db` の Drizzle スキーマから生成した、D1 に実在する表と外部キーの ER 図である。この文書は手で直さず、`vp test run -u apps/internal-dashboard/src/shared/schema-document` で作り直す。",
  "",
  "```mermaid",
  erDiagram(schema),
  "```",
  "",
].join("\n");

describe("the schema page of the wiki", () => {
  it("matches the ER diagram of the current schema", () =>
    expect(schemaDocument).toMatchFileSnapshot("../../../content/docs/data-model/schema.md"));
});
