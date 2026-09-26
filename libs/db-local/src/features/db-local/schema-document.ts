import { repositoryFile } from "@repo/config/repository-root";
import { erDiagram, schema } from "@repo/db";

const schemaDocumentPath = repositoryFile(
  "apps/internal-dashboard/content/docs/data-model/schema.md",
);

const schemaDocument = (): string =>
  [
    "---",
    "title: 実装のスキーマ",
    "description: libs/db の Drizzle スキーマから生成した、D1 の表と外部キーの ER 図",
    "---",
    "",
    "`libs/db` の Drizzle スキーマから生成した、D1 に実在する表と外部キーの ER 図である。この文書は手で直さず、`vp run --filter @repo/db db:generate` で作り直す。",
    "",
    "```mermaid",
    erDiagram(schema),
    "```",
    "",
  ].join("\n");

export { schemaDocument, schemaDocumentPath };
