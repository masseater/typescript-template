---
title: このテンプレートは何か
description: テンプレートの全体像、解決する課題、含まれているものと主要技術
---

## 概要

Cloudflare のインフラ上で本番運用できる会員制サービスを構築するための、TypeScript によるフルスタックテンプレートです。

AI エージェントと人間が協調して高速に開発・運用サイクルを回すことを前提に設計されており、インフラの宣言、型安全な境界、機械的な品質の確認、および測れる観測性が単一のリポジトリに統合されています。

入っている会員機能（認証、プロフィール、AI インタビュー、掲示板など）は見本実装であり、そのまま本番水準の品質を満たすところから始められます。使う側はここから、自分のサービスに必要な機能を足していきます。

## 解決する課題と目指す姿

Web サービスの立ち上げと継続的な開発において、次の課題を解決することを目指しています。

- AI エージェントの自律開発: 人間が指示を出し、AI エージェントがコードの読解、実装、ブラウザ操作による画面確認、ログやトレースの計測までを自律的に遂行できる構造を提供します。
- 暗黙知や口約束の排除: コーディング規約を文章で強制するのではなく、型システム・lint・自動テスト・タスクランナーにより、不変条件の違反を機械的に検出します。
- 外部状態とコードの一致: 管理画面での手作業による設定変更を禁止し、Cloudflare の全資源を Alchemy のコードとして宣言・同期します。
- 意図と実装の同期: ドメインのデータモデル、画面仕様、判断基準をドキュメント（wiki）として一元管理し、コードと意図が乖離しない状態を維持します。

## 含まれているもの

次の機能は、このテンプレートにそのまま動く状態で含まれています。会員機能は見本実装なので、サービスに合わせて足したり外したりしてください。画面の枠だけを用意して中身がまだ無いものは、その旨を書いています。

### アプリケーション

各アプリの役割と境界は [アプリの役割](/getting-started/applications) に、画面ごとの仕様は [ページ構成](/pages/member-layout) にあります。

- 利用者アプリ: 会員が登録してプロフィールを作り、ほかの会員を知ってやり取りするアプリ。
  - 登録とログイン: メールとパスワード、メールアドレスの確認、メールアドレス変更の確認。
  - 初回の案内: 規約への同意、プロフィールの入力、AI インタビューを順に進める。
  - プロフィールの閲覧と編集、会員の一覧と検索。
  - 掲示板: スレッド、投稿、返信。
  - AI インタビュー: [Workers AI](https://developers.cloudflare.com/workers-ai/) と対話してインタビューシートを作る。回数に上限がある。
  - ホームフィード: フォロー中の会員のプロフィール更新を並べる。
  - リアルタイムの受信: [Durable Objects](https://developers.cloudflare.com/durable-objects/) が会員ごとに通知とフィードを持ち、WebSocket で届ける。
  - お問い合わせフォーム: 会員でない人からの問い合わせを、運用担当宛てのメールで送る。
  - 日本語と英語の切り替え（[Paraglide JS](https://paraglidejs.com/)）。
  - 画面の枠だけのもの: メッセージ、通知の一覧、有料プラン、サポート、設定の一部、退会。
- 管理者アプリ: 運用担当が利用者の状況を調べ、処置するアプリ。
  - 利用者の一覧、絞り込み、役割の変更、削除。最後の管理者は消せず、操作は監査ログに残る。
  - 管理者のログインには二要素認証を必須にしている。
  - 画面の枠だけのもの: 利用者の詳細、問い合わせ、通報、規約、管理者の一覧。
- wiki: 社内向けの文書サイト。このページもここで配っている。
  - 全文検索と、埋め込みによる意味検索。
  - AI エージェントに文書を配る MCP サーバーと、その OAuth 認可。
  - Mermaid の図の描画と、[用語集](/glossary) への自動リンク。
  - 本文は、TOTP か passkey を通したセッションにだけ返す。
  - 機能フラグの一覧と切り替え。
  - 画面の枠だけのもの: 概要の集計、監査ログ、メンバー、問い合わせ。
  - 使っているもの: [Fumadocs](https://fumadocs.dev/)、[Model Context Protocol](https://modelcontextprotocol.io/)、[Mermaid](https://mermaid.js.org/)

### アプリが共通で使うもの

- 認証: メールとパスワード、メールアドレスの確認、TOTP の二要素認証とバックアップコード、passkey、レート制限。アカウントは利用者・管理者・wiki で別々に持つ。
  - 使っているもの: [Better Auth](https://better-auth.com/)
  - 詳しくは: [アカウント](/data-model/accounts)
- データベース: スキーマ、マイグレーション、ローカルの D1、テスト用の DB。スキーマから ER 図を生成する。
  - 使っているもの: [Drizzle ORM](https://orm.drizzle.team/)、[Cloudflare D1](https://developers.cloudflare.com/d1/)
  - 詳しくは: [データモデル](/data-model/overview)、[スキーマ](/data-model/schema)
- API: 型付きの HTTP API と、その型を共有するクライアント。エラーと依存を型で扱う。
  - 使っているもの: [Elysia](https://elysiajs.com/)、[Eden](https://elysiajs.com/eden/overview.html)、[Effect](https://effect.website/)
  - 詳しくは: [Elysia](/tech-stack/elysia)、[Effect](/tech-stack/effect)
- 非同期処理: キューでジョブを受け、ワークフローで段階的に処理する見本。
  - 使っているもの: [Cloudflare Queues](https://developers.cloudflare.com/queues/)、[Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- 内部の呼び出し: インターネットから届かない core Worker を、[Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) 経由の RPC で呼ぶ。中身はまだ疎通の確認だけ。
- ファイル保管と読み取りキャッシュ: [R2](https://developers.cloudflare.com/r2/) と [KV](https://developers.cloudflare.com/kv/) を使うライブラリと資源の定義。アプリからはまだ呼んでいない。
- 機能フラグ: フラグの評価と切り替え。切り替えには権限が要り、監査ログに残る。定義済みのフラグはまだ無い。
  - 使っているもの: [OpenFeature](https://openfeature.dev/)、[Cloudflare Flagship](https://developers.cloudflare.com/flagship/)
  - 詳しくは: [OpenFeature](/tech-stack/openfeature)
- UI コンポーネント: ボタン、フォーム、テーブル、ダイアログ、トースト、アプリの枠などの共通コンポーネントと、その Storybook。
  - 使っているもの: [Base UI](https://base-ui.com/)、[shadcn/ui](https://ui.shadcn.com/)、[Tailwind CSS](https://tailwindcss.com/)、[Storybook](https://storybook.js.org/)
  - 詳しくは: [UI](/tech-stack/ui)、リポジトリ直下の `DESIGN.md`

### 観測と監視

- ログとトレース: サーバーとブラウザのログ、トレース、Web Vitals を OTLP で送り、要求ごとに span を作る。
  - 使っているもの: [OpenTelemetry](https://opentelemetry.io/)、[Workers Observability](https://developers.cloudflare.com/workers/observability/)
  - 詳しくは: [Observability](/observability)、[ブラウザ](/observability/browser)
- 手元の観測環境: ログとトレースを手元で引ける環境と、送ったメールの受け口。
  - 使っているもの: [grafana/otel-lgtm](https://github.com/grafana/docker-otel-lgtm)、[Mailpit](https://github.com/axllent/mailpit)
- 監視と警告: 定期実行の監視が 3 つあり、アプリの疎通が途切れたとき、エラーが閾値を超えたとき、Cloudflare の請求額が予算を超えそうなときにメールで知らせる。

### インフラとデプロイ

- インフラの宣言: [Workers](https://developers.cloudflare.com/workers/)、D1、KV、R2、Queues、Workflows、Durable Objects、Workers AI、メール送信など、上に挙げた Cloudflare の資源をコードで宣言し、管理画面での手作業を無くす。
  - 使っているもの: [Alchemy](https://v2.alchemy.run/)、[Cloudflare](https://www.cloudflare.com/)
  - 詳しくは: [Alchemy](/tech-stack/alchemy)、[Cloudflare](/tech-stack/cloudflare)
- デプロイ: main への push で staging に、手動の実行で production にデプロイし、デプロイ後に各アプリへ届くかを確かめる。
  - 使っているもの: [GitHub Actions](https://github.com/features/actions)

### 開発と品質の確認

- タスクと確認: ビルド、型チェック、lint、テスト、使われていないコードの検出、ミューテーションテストを 1 つのツールから実行する。
  - 使っているもの: [Vite+](https://viteplus.dev/)、[fallow](https://github.com/fallow-rs/fallow)、[Stryker](https://stryker-mutator.io/)
  - 詳しくは: [Vite+](/tech-stack/vite-plus)
- 構造の機械的な確認: 層の分離、依存の向き、秘匿値の混入などを、独自の lint とリポジトリのチェックで止める。
  - 使っているもの: [Oxlint](https://oxc.rs/docs/guide/usage/linter)、[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)、[Feature-Sliced Design](https://fsd.how/)
  - 詳しくは: [Feature-Sliced Design](/tech-stack/feature-sliced-design)
- E2E と負荷試験: 3 つのアプリを実際の Worker とローカルの D1 で通しに確かめる E2E と、負荷試験。
  - 使っているもの: [Playwright](https://playwright.dev/)、[k6](https://k6.io/)
- CI とマージキュー: PR ごとに影響範囲に応じてチェックを分けて回し、`ready-to-merge` ラベルの PR をキューで順にマージする。依存の更新 PR も自動で作られる。
  - 使っているもの: [GitHub Actions](https://github.com/features/actions)、[Mergify](https://mergify.com/)、[Renovate](https://docs.renovatebot.com/)
  - 詳しくは: [開発の流れ](/getting-started/development-flow)

### AI エージェント向けの仕組み

- 作業の取り決めと skill: リポジトリと各パッケージの `AGENTS.md` と、実装やレビューの判断基準を持つ skill。
- Claude Code の hooks: 作業の始まり、指示を受けたとき、作業の終わりに最新の main を取り込む。
  - 使っているもの: [Claude Code](https://code.claude.com/docs/en/overview)
- コマンドの補助: 重いコマンドの同時実行を制限し、出力の量を抑える CLI。
- 画面の操作と観測の CLI: エージェントがブラウザで画面を操作し、その操作に対応するログとトレースを引くための開発用 CLI。
  - 使っているもの: [agent-browser](https://github.com/vercel-labs/agent-browser)
- Issue からの自動 PR: `can-not-now` ラベルの Issue を毎日処理して PR にする。
  - 使っているもの: [Claude Code Action](https://github.com/anthropics/claude-code-action)

### 設計文書

- この wiki: [用語集](/glossary)、[データモデル](/data-model/overview)、[ページ構成](/pages/member-layout)、[技術スタック](/tech-stack)、[Observability](/observability) の解説を持つ。

## 含まれていないもの

次の機能は、このテンプレートには意図的に含めていません。テンプレートに無いだけで、実際の開発ではサービスの規模に合わせて入れるかどうかを検討してください。

- セッションリプレイ: 利用者の操作を DOM の変化として録画し、trace id でトレースと結びつけて再生する機能。
  - 含めない理由: 録画は 1 セッションごとに DOM の全変化を持つため、保存と検索の費用がログやスパンより桁で大きく、規模が決まる前に費用だけが先に立つ。
  - 入れるときに要るもの: OTLP の宛先の切り替えと `traceparent` の伝搬は既にある。足りないのは録画のセッション識別子を要求へ載せる部分だけ。
  - 検討する時期: エラーの再現に利用者の操作の再現が要るようになったとき。エラーが起きたセッションだけを録画する構成から始める。
  - OSS の例: [rrweb](https://github.com/rrweb-io/rrweb)（記録と再生のライブラリのみ）、[OpenReplay](https://github.com/openreplay/openreplay)（リプレイ専用）、[ClickStack / HyperDX](https://github.com/hyperdxio/hyperdx)（ログ・トレースと同じ基盤）、[PostHog](https://github.com/PostHog/posthog)（製品分析と同居）
  - SaaS の例: [PostHog Cloud](https://posthog.com/session-replay)、[Sentry](https://sentry.io/for/session-replay/)、[Microsoft Clarity](https://clarity.microsoft.com/)、[LogRocket](https://logrocket.com/)、[FullStory](https://www.fullstory.com/)、[Datadog RUM](https://www.datadoghq.com/product/real-user-monitoring/)
- 行動分析: ヒートマップ、ファネル、リテンションなど、利用者の操作を集計して製品の改善に使う機能。
  - 含めない理由: テンプレートの観測性はログ・トレース・メトリクスで不具合を直すことを目的にしており、何を集計するかはサービスごとに決まる。
  - 入れるときに要るもの: 上のセッションリプレイと同じ計測基盤に載せると、識別子を二重に持たずに済む。
  - OSS の例: [PostHog](https://github.com/PostHog/posthog)（ファネルやリテンションまで）、[Matomo](https://github.com/matomo-org/matomo)、[Umami](https://github.com/umami-software/umami)、[Plausible](https://github.com/plausible/analytics)（ページ単位の集計）
  - SaaS の例: [PostHog Cloud](https://posthog.com/product-analytics)、[Mixpanel](https://mixpanel.com/)、[Amplitude](https://amplitude.com/)、[Hotjar](https://www.hotjar.com/)（ヒートマップ中心）、[Google Analytics](https://marketingplatform.google.com/about/analytics/)

## 主要な技術スタック

各技術の定義と参照は [技術スタック](/tech-stack) に記載します。この表が持つのは領域の対応だけです。信号がブラウザから SLI まで通る層は [Observability](/observability) に記載します。

| 領域 | 採用技術 | 役割 |
| --- | --- | --- |
| インフラ / 実行基盤 | Cloudflare Workers, D1, Durable Objects, Workflows, Queues | サーバーレスで高速に動作する本番実行環境 |
| IaC | Alchemy v2 | Cloudflare のリソース定義と構成管理 |
| モノレポ / ツール | Vite+, TypeScript, pnpm workspaces | 高速なビルド、型チェック、lint、テスト実行 |
| アプリケーション | TanStack Start, Elysia, React 19, Tailwind CSS 4 | フルスタック Web アプリケーション基盤 |
| ロジック / 認証 / DB | Effect v4, Better Auth, Drizzle ORM | 型安全なエラー処理、多要素・パスキー認証、DB 操作 |
| フロントエンド UI | Base UI, shadcn/ui, Feature-Sliced Design (steiger) | a11y を担保した統一 UI と保守性の高い層分離 |
| 観測性 | OpenTelemetry, Workers Observability | 計測したログ・分散トレースの収集と監視 |

## 次に読むもの

- [アプリの役割](/getting-started/applications): 各アプリが誰のために何をし、どのデータに触れるか
- [開発の流れ](/getting-started/development-flow): 日常の開発サイクル、AI 協調、品質の確認
- [使い始める手順](/getting-started/first-steps): テンプレートを自分のサービス向けにカスタマイズする手順
