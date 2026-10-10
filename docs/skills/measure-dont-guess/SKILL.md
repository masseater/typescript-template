---
name: measure-dont-guess
description: 機能開発や不具合調査に取り掛かる前に、AIが自分で動作を再現・観測できる手段（テスト、Effectのログとスパン、開発サーバーの出力、Playwright CLIによるブラウザ操作）を用意する手順。新しい機能を書き始めるとき、不具合を調べるとき、原因を推測で決めそうになったときに使う。
---

# 推測するな、計測しろ

挙動や原因を推測で決めない。観測した事実だけを根拠に判断する。
機能開発へ取り掛かる前に、AIが自分で動作を確かめられる仕組みを先に作る。

## 着手前に揃えるもの

1. 再現手段を用意する。期待する動作や不具合を、コマンド1つで何度でも再実行できる形にする。
2. 観測点を置く。変更するコードの経路に、ログかスパンを置く。
3. 観測経路を確かめる。その出力を自分で読めることを、一度実際に読んで確かめる。

3つが揃うまで機能のコードを書かない。
揃えられないときは、推測で進めずに何が足りないかをユーザーに伝える。

## 再現する

ロジックはVitestのテストで再現し、`vp test` で実行する。
不具合はまず失敗するテストとして書き、失敗を確かめてから直す。
テストはFSDのコロケーションに従い、対象のコードの隣に置く。

## サーバー側を観測する

サーバーのコードはEffectで書き、`Effect.log`・`Effect.logDebug`・`Effect.annotateLogs` でログを出す。
処理の区間には `Effect.withSpan` を付ける。`apps/web/src/pages/home/api/routes.server.ts` の `todo.list` が例である。
`console` はlintが落とすため、残すログはEffectのロガーで出す。

ログとトレースは次の場所で読む。

- ローカルでは、`apps/web` で起動した `vp run dev`（`alchemy dev`）のターミナルに出る。
- `OTEL_EXPORTER_OTLP_ENDPOINT` を設定すると、トレース・メトリクス・ログがOTLPで送られる。設定は `apps/web/alchemy.run.ts` にある。
- デプロイしたWorkerのログは `vp exec alchemy logs --tail` で読む。過去の分は `--since 30m` のように指定して取る。

## ブラウザ側を観測する

`apps/web/vite.config.ts` の `@tanstack/devtools-vite` は、既定でブラウザのconsoleを開発サーバーのターミナルへ転送する。
ターミナルには `[Client]` が付いて出る。
逆に、サーバーのログはブラウザのconsoleに `[Server]` が付いて出る。

画面の操作と観測はPlaywright CLIで行う。

```sh
vp dlx @playwright/cli open http://localhost:5173/
vp dlx @playwright/cli snapshot
vp dlx @playwright/cli console
vp dlx @playwright/cli requests
vp dlx @playwright/cli screenshot
vp dlx @playwright/cli close
```

URLは開発サーバーが表示したものに置き換える。
詳しい使い方は `vp dlx @playwright/cli --help` と、ヘルプの先頭に表示される同梱スキルを読む。

Claude Codeのクラウド環境にはChromeがないため、事前に入っているChromiumを設定で指す。

```sh
mkdir -p .playwright
chrome="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome | tail -n 1)"
printf '{"browser":{"browserName":"chromium","launchOptions":{"executablePath":"%s"}}}\n' "$chrome" >.playwright/cli.config.json
```

`.playwright/` と出力先の `.playwright-cli/` はgitの管理外である。

## 環境が足りないとき

`alchemy dev` にはCloudflareの認証情報が要る。
認証情報がないと `CredentialsUnavailable` で止まる。
`vp dev` を直接使っても `cloudflare:workers` を解決できず、画面は表示されない。

この場合はテストとログで確かめられる範囲を進める。
画面を確かめていないことはユーザーに明示し、認証情報の設定を頼む。

## 片付ける

調べるために一時的に足した出力は消す。
今後の調査にも役立つログとスパンは残す。
