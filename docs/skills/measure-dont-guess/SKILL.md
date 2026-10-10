---
name: measure-dont-guess
description: 「推測するな、計測しろ」を実践する手順。仮説を立てたら、実装や修正に入る前に何を計れば白黒がつくかを決め、計る仕組みを作り、計って記録し、その結果だけで判断する。不具合の原因を調べるとき、性能や挙動を比べるとき、新しい機能を書き始めるとき、「たぶん」で判断しそうになったときに使う。
---

# 推測するな、計測しろ

推測は仮説を作るためだけに使う。
判断と変更は、計測した事実だけを根拠にする。

## ほかのスキルとの分担

不具合や失敗するテストの根本原因は、`systematic-debugging` スキルの手順で調べる。
「直った」「通った」と報告する前の確認は、`verification-before-completion` スキルに従う。
どちらも obra/superpowers のスキルで、`skills-lock.json` で入れている。

このスキルは、その2つが扱わない部分を受け持つ。
計る前に判定基準を決めること、機能開発や性能比較の前に計る仕組みを作ること、このリポジトリで何をどう計るかである。

## 手順

1. 問いを1つに絞る。「なぜ一覧が空になるのか」「AとBのどちらが速いか」のように、答えが事実で決まる形にする。
2. 仮説を書き出す。思いつく原因や結果をすべて挙げ、1つに決め打ちしない。
3. 計る対象と判定基準を先に決める。仮説ごとに、何を計ればその仮説が正しいか間違いかが分かるかを書く。どの値なら採用し、どの値なら捨てるかも計る前に決める。
4. 計る仕組みを作る。再現手段と観測点を用意し、結果が分かっている入力で一度動かして、仕組みが正しく計れることを確かめる。
5. 計る。条件を固定し、変えるのは1つだけにする。時間や性能は複数回計り、ばらつきも見る。
6. 記録する。条件、実行したコマンド、生の結果をそのまま残す。
7. 判断する。仮説を採るか捨てるかは、手順3の基準に従う。予想と違う結果が出たら、仮説の方を疑う。
8. 変えたあと、同じ仕組みで同じように計り、効果を確かめる。

どの仮説も確定しないときは、計る対象を増やして手順3に戻る。
計れない理由があるときは、推測で進めずに何が足りないかをユーザーに伝える。

## 機能開発の前に

新しい機能は、完成したことを計る仕組みと、動作を観測する点を先に作ってから書く。
受け入れ条件を自動で確かめるテストかスクリプトを用意し、まだ失敗することを確かめる。
そのうえで機能を書き、同じ仕組みが通ることで完成とする。

## 記録の残し方

計測していない主張は、推測であると明記する。
変更の根拠になった計測は、条件とコマンドと結果をコミットメッセージに書く。
都合の悪い結果を、計り方を変えて消さない。

## 何をどう計るか

計る信号は、OpenTelemetryのMELT（Metrics、Events、Logs、Traces）から選ぶ。
サーバーのコードはEffectで書き、どの信号もEffectのAPIで出す。
`apps/web/src/shared/telemetry/telemetry.server.ts` の `telemetryLive` が、OTLPで外へ送る。

| 信号    | 答える問い                         | Effectでの出し方                                        |
| ------- | ---------------------------------- | ------------------------------------------------------- |
| Metrics | 何回起きたか、どれだけかかったか   | `Metric.counter`・`Metric.histogram` を `Metric.update` |
| Events  | その時点で何が起きたか             | スパンの中で `Effect.logInfo` を出す                    |
| Logs    | どの入力でどの分岐を通ったか       | `Effect.logInfo` と `Effect.annotateLogs`               |
| Traces  | どこで時間を使い、どの順に呼んだか | `Effect.withSpan` と `Effect.annotateCurrentSpan`       |

スパンの中で出したログは、そのスパンのイベントとしても記録される。
ログには `trace_id` と `span_id` が付き、トレースとログを突き合わせられる。
`console` はlintが落とすため、計測にはEffectのAPIを使う。

課題ごとに、計る信号を次のように選ぶ。
不具合なら、入力と分岐をログの属性に出し、トレースで通った経路を確かめ、失敗するテストで再現する。
遅さなら、スパンの所要時間を変更の前後で比べ、ロジック単体は `vp test bench` で比べる。
新しい機能なら、受け入れテストに加えて、成功と失敗の回数をメトリクスで、処理の区間をスパンで出す。

## 計測結果をAIが自分で読む

ローカルでは、OTLPの受け口とGrafanaをまとめた `grafana/otel-lgtm` を立てる。

```sh
cd apps/web
vp run otel
```

`apps/web/.env` に `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` を書いてから `vp run dev` を起動する。
`apps/web/alchemy.run.ts` は、この値があると `OTEL_TRACES_EXPORTER` などを `otlp` にして渡す。
Effectの `Otlp.layerFromConfig` はこれらがないと何も送らないため、アプリの外で計るときも同じ値を設定する。
トレースは送ってから検索できるまで数十秒かかる。
Grafanaはポート3000で、ユーザー名とパスワードはどちらも `admin` である。

計測結果は、`.mcp.json` に登録した `grafana` MCPサーバー（mcp-grafana）で読む。
データソースのUIDは `prometheus`・`loki`・`tempo` である。
メトリクスは `query_prometheus`、ログは `query_loki_logs` で読む。
トレースは `search_tempo_traces` で探し、`get_tempo_trace` で中身を読む。

MCPサーバーがつながっていないときは、GrafanaのHTTP APIで同じものを読む。

```sh
curl -s -u admin:admin -G localhost:3000/api/datasources/proxy/uid/prometheus/api/v1/query --data-urlencode 'query=todo_list_requests'
curl -s -u admin:admin -G localhost:3000/api/datasources/proxy/uid/loki/loki/api/v1/query_range --data-urlencode 'query={service_name="web"}'
curl -s 'localhost:3200/api/search?tags=service.name%3Dweb'
```

Claude Codeのクラウド環境ではDockerデーモンが止まっているため、先に `dockerd` をバックグラウンドで起動する。

デプロイしたWorkerのログは `vp exec alchemy logs --tail` で読む。
CloudflareのWorkers Observabilityには、公式のリモートMCPサーバー（`https://observability.mcp.cloudflare.com/sse`）がある。
これをつなぐと、AIが本番のログを直接問い合わせられる。

## そのほかの計り方

再現とロジックの検証には、Vitestのテストを `vp test` で使う。
テストは対象のコードの隣に置く。
速さの比較には `vp test bench` でVitestのベンチマークを使う。

Effectのログは、`apps/web` の `vp run dev`（`alchemy dev`）のターミナルにも出る。

ブラウザは `vp dlx @playwright/cli` で操作し、`console`・`requests`・`snapshot` で観測する。
`@tanstack/devtools-vite` は、ブラウザのconsoleを開発サーバーのターミナルへ転送する。
Claude Codeのクラウド環境にはChromeがない。
`.playwright/cli.config.json` の `launchOptions.executablePath` で、`/opt/pw-browsers` のChromiumを指す。

`alchemy dev` にはCloudflareの認証情報が要り、ない場合は `CredentialsUnavailable` で止まる。
このときはテストとログで計れる範囲を進め、画面を計れていないことをユーザーに伝える。
