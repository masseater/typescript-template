---
name: measure-dont-guess
description: 仮説を白黒つける計測を実装や修正の前に決めて実行し、その結果だけで判断する。不具合の原因を調べるとき、性能や挙動を比べるとき、新しい機能を書き始めるとき、「たぶん」で判断しそうになったときに使う。
---

# 推測するな、計測しろ

根本原因の調べ方は `.agents/skills/systematic-debugging/SKILL.md` に従う。
完了と報告する前の確認は `.agents/skills/verification-before-completion/SKILL.md` に従う。

## どこで計るか

判断の根拠にする計測は、本番環境で行う。
本番で計れないときは、コード、設定、インフラ、データの規模と形、外部サービスを本番と同じにしたステージング環境を作って計る。
手元やテスト環境の計測は、計る仕組みが動くかを確かめるためだけに使う。

## 手順

1. 答えが事実で決まる問いを1つ立てる。
2. 考えられる仮説をすべて挙げる。
3. 仮説ごとに、計る対象と、採用する値・捨てる値を計る前に書く。
4. 再現手段と観測点を作り、結果が分かっている入力で正しく計れることを確かめる。
5. 変える条件を1つにして計る。時間や性能は複数回計り、ばらつきも見る。
6. 条件、コマンド、生の結果を残す。
7. 手順3の基準で判断する。予想と違えば仮説を疑う。
8. 変更後に同じ仕組みで計り直し、効果を確かめる。

どの仮説も確定しなければ、計る対象を増やして手順3に戻る。
計れないときは推測で進めず、何が足りないかをユーザーに伝える。

新しい機能は、受け入れ条件を確かめるテストかスクリプトを先に書き、失敗することを確かめてから実装する。

計測していない主張は推測と明記する。
変更の根拠にした計測は、条件とコマンドと結果をコミットメッセージに書く。
都合の悪い結果を、計り方を変えて消さない。

## 何を計るか

サーバーの信号はEffectのAPIで出す。
送信先の設定は `apps/web/src/shared/telemetry/telemetry.server.ts` にある。

| 課題   | 出すもの                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| 不具合 | 入力と分岐を `Effect.annotateLogs` 付きの `Effect.logInfo` で出し、`Effect.withSpan` で経路を見て、テストで再現する |
| 遅さ   | `Effect.withSpan` の所要時間を変更の前後で比べ、ロジック単体は `vp test bench` で比べる                             |
| 新機能 | 受け入れテストに加え、成功と失敗の回数を `Metric.counter`、処理の区間を `Effect.withSpan` で出す                    |

テストは対象のコードの隣に置き、`vp test` で回す。

## 計測結果を読む

以下の手元の環境は、計る仕組みが動くかを確かめるためのものである。
判断に使う計測は、本番かステージングの送信先で行う。
クラウド環境では、先に `dockerd` をバックグラウンドで起動する。
`apps/web` で `vp run otel` を実行し、`apps/web/.env` に `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` を書いてから `vp run dev` を起動する。
アプリの外で計るときも、同じ値を設定する。
結果は `.mcp.json` の `grafana` MCPサーバーで読む。
データソースのUIDは `prometheus`・`loki`・`tempo` である。
トレースは送ってから検索できるまで数十秒かかる。

MCPサーバーがつながらないときは、GrafanaのHTTP APIで読む。

```sh
curl -s -u admin:admin -G localhost:3000/api/datasources/proxy/uid/prometheus/api/v1/query --data-urlencode 'query=todo_list_requests'
curl -s -u admin:admin -G localhost:3000/api/datasources/proxy/uid/loki/loki/api/v1/query_range --data-urlencode 'query={service_name="web"}'
curl -s 'localhost:3200/api/search?tags=service.name%3Dweb'
```

Effectのログとブラウザのconsoleは、`vp run dev` のターミナルにも出る。
デプロイしたWorkerのログは `vp exec alchemy logs --tail` で読む。
本番のログは、`.mcp.json` の `cloudflare-api` MCPサーバーでWorkers Observabilityに問い合わせる。

## ブラウザ

`vp dlx @playwright/cli` で操作し、`console`・`requests`・`snapshot` で観測する。
クラウド環境では、`.playwright/cli.config.json` の `launchOptions.executablePath` に `/opt/pw-browsers` のChromiumを書く。

`alchemy dev` が `CredentialsUnavailable` で止まったら、テストとログで計れる範囲を進め、画面を計れていないことをユーザーに伝える。
