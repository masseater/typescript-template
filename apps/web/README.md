# web

Cloudflare Workers で動く Web アプリで、SSR と `/api/*` を 1 つの Worker で受け、データを D1 に置く。

テンプレート自身は <https://typescript-template-web-production-ntesuocc46gilfjl.masseater.workers.dev> に配信している。

## アプリ名を変える

`alchemy.app-name.ts` の `APP_NAME` を、リポジトリの名前に変える。
同じ Cloudflare アカウントにある別のリポジトリと名前が重なると、互いのリソースを置き換え合う。

## 手元で動かす

アプリをローカルで実行するには、Alchemy用のCloudflareプロファイルを登録し、開発サーバーを起動する。

```sh
vp exec alchemy profile edit --add Cloudflare
vp run dev
```

## デプロイ

main への push のたびに本番へデプロイされる。
手元からデプロイするときは、次を実行する。

```sh
vp run deploy
```
