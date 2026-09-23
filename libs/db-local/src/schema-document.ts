import { erDiagram, schema } from "@repo/db";
import { Effect, Path } from "effect";

const schemaDocumentPath = Effect.flatMap(Path.Path, (hostPath) =>
  hostPath.fromFileUrl(
    new URL("../../../apps/internal-dashboard/content/docs/data-model/schema.md", import.meta.url),
  ),
);

const schemaDocument = (): string =>
  [
    "---",
    "title: 実装のスキーマ",
    "description: libs/db の Drizzle スキーマから生成した、D1 の表と外部キーの ER 図",
    "---",
    "",
    "`libs/db` の Drizzle スキーマから生成した、D1 に実在する表と外部キーの ER 図である。概念の関係は [データモデルの全体](/data-model/overview) が持つ。この文書は手で直さず、`vp run --filter @repo/db db:generate` で作り直す。",
    "",
    "```mermaid",
    erDiagram(schema),
    "```",
    "",
  ].join("\n");

export { schemaDocument, schemaDocumentPath };
