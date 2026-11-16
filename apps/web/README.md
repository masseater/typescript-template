# web

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
