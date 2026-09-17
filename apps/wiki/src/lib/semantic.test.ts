import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { prepareSemanticAssets } from "../../semantic-build.ts";
import { createSemanticIndex } from "./semantic.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const publicDirectory = fileURLToPath(new URL("../../public/semantic/", import.meta.url));
const assets = await prepareSemanticAssets(root, publicDirectory);
const files = {
  async fetch(request: Request) {
    const pathname = new URL(request.url).pathname;
    return new Response(await readFile(path.join(publicDirectory, path.basename(pathname))));
  },
};
const documents = [
  {
    id: "setup",
    url: "/setup",
    title: "開発環境の構築",
    text: "pnpm dev:setup を実行し、Docker で Grafana LGTM を起動します。",
  },
  {
    id: "deploy",
    url: "/deploy",
    title: "本番デプロイ",
    text: "Pulumi で Cloudflare Workers に user と admin を反映します。",
  },
  {
    id: "passkey",
    url: "/passkey",
    title: "パスキー認証",
    text: "WebAuthn を使ってパスワードなしでログインできます。",
  },
  {
    id: "migration",
    url: "/migration",
    title: "D1 マイグレーション",
    text: "drizzle-kit でスキーマ差分から SQL を生成します。",
  },
];

test.for([
  ["パスワードを使わずにサインインしたい", "passkey"],
  ["テーブル定義を変更したい", "migration"],
  ["ローカルで動かすにはどうすればいい？", "setup"],
] as const)("finds %s without sharing words with the document", async ([query, expected]) => {
  const search = createSemanticIndex(assets, () => Promise.resolve(documents));
  const [best] = await search(files, "http://localhost", query, 1);
  expect(best?.document.id).toBe(expected);
});

test("a missing model asset is reported and retried on the next query", async () => {
  let available = false;
  const flaky = {
    fetch: (request: Request) =>
      available ? files.fetch(request) : Promise.resolve(new Response(null, { status: 404 })),
  };
  const search = createSemanticIndex(assets, () => Promise.resolve(documents));
  await expect(search(flaky, "http://localhost", "パスキー", 1)).rejects.toThrow(
    "WIKI_SEMANTIC_ASSET_UNAVAILABLE",
  );
  available = true;
  expect((await search(flaky, "http://localhost", "パスキー", 1))[0]?.document.id).toBe("passkey");
});
