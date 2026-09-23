---
title: 使い始める手順
description: テンプレートを自分のサービス向けにカスタマイズし、最初のデプロイを行うまでの手順
---

この文書では、このテンプレートをベースに新しいサービスを立ち上げる際の初期設定と手順を説明します。

## 1. サービスの定義と文言の変更

まずはサービスの性質と規模をまとめ、そのうえでサービス名や初期コンテンツを自分のサービスに合わせて変更します。

- **サービスの性質と規模のまとめ**:
  - 利用者数、データ量、書き込みの頻度と同時に来る量、伸び方の見込み、扱うデータの性質（個人情報・決済など）を最初に書き出し、`apps/internal-dashboard/content/docs` に置きます。
  - テンプレートの構成がそのまま使えるかは規模で変わります。4. の DB や 5. の決済代行業者の選択など、以降の判断はこのまとめを前提にします。
- **サービス名の変更**: 利用者アプリのサービス名設定（`apps/service-member/src/shared/config/service.ts`）を更新します。
- **LP と見本コンテンツの刷新**:
  - `apps/service-member` の LP（`/pages/member-lp`）や各種文言を書き換えます。
  - AI インタビューの見本テーマを自社サービスのユースケースに合わせて見直します。

## 2. ドメインモデルとスキーマの調整

会員サービスの概念モデルを自身の要件に合わせて再設計します。

1. **ドキュメントの更新**:
   - `content/docs/data-model/` の各文書と ER 図を更新し、残す概念と捨てる概念を整理します。
   - [用語集](/glossary) の用語定義をサービスの語彙に合わせます。
2. **DB スキーマとマイグレーション**:
   - `libs/db` の Drizzle スキーマ定義を更新します。
   - 新しいマイグレーションファイルを生成してコミットします。

## 3. インフラと環境設定

デプロイ先環境（Cloudflare）の資格情報と設定を準備します。

- **GitHub Environment の secret**:
  - 置き場所は Environment `staging` と `production` です。リポジトリ secret には置きません。
  - `staging` の必須キーが揃っているとき、main への統合が staging へ適用します。1つも無いときは適用を始めず、一部だけあるときは失敗します。
  - `production` は Actions の deploy を `workflow_dispatch` で target `production` にしたときだけ適用します。Environment に承認者を付けます。
  - 両方でキー名は同じです。`TEMPLATE_PREFIX` と、そこから決まる origin・送信ドメインは環境ごとに分けます。
  - 必須キーは `libs/observability/src/deployment-keys.ts` の `deploymentKeys` です。
    - `ALERT_EMAIL`: カンマ区切りのメールアドレス。1〜10 個。
    - `BUDGET_JPY`: 正の数。予算監視は実行のたびに取得した為替レートで米ドルに換算し、固定費と予備費を引いた残りを使える額とします。残りが無いと予算監視が失敗を通知します。
    - `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_ZONE_ID`: 16進 32 文字。
    - `CLOUDFLARE_API_TOKEN`: Cloudflare API トークン。
    - `TEMPLATE_APP_DOMAIN`: URL ではなくホスト名（`example.com`）。`workers.dev` は不可。origin は `https://{TEMPLATE_PREFIX}-member.{TEMPLATE_APP_DOMAIN}`、`https://{TEMPLATE_PREFIX}-admin.{TEMPLATE_APP_DOMAIN}`、`https://{TEMPLATE_PREFIX}-dashboard.{TEMPLATE_APP_DOMAIN}` になります。
    - `TEMPLATE_AUTH_SECRET`: 32 文字以上、異なる文字が 16 種以上、前後に空白を付けない。
    - `TEMPLATE_MAIL_FROM`: メールアドレス。`@` 以降は `{TEMPLATE_PREFIX}.` で始まること。
    - `TEMPLATE_PREFIX`: 先頭は英小文字、続きは英小文字・数字・ハイフン。全体で 3〜36 文字。
  - 空でも適用は始まります。値があるときだけデプロイへ渡ります。
    - `TEMPLATE_OTLP_ENDPOINT`: https の URL。
    - `TEMPLATE_OTLP_ENABLED`: `true` か `false`。`TEMPLATE_OTLP_ENDPOINT` を置くときは必須です。
    - `TEMPLATE_OTLP_AUTHORIZATION`: トレース送信の認可。
- **検索エンジン設定**:
  - テンプレートの初期状態では、全ページに `x-robots-tag: noindex, nofollow` が付与されています（`libs/runtime/src/worker.ts`）。
  - 一般公開する際は、公開対象のパスについてこの設定を見直し、本番応答でヘッダーを確認してから公開します。
- **Alchemy によるインフラ適用**:
  - `infra/cloudflare` でリソースの `plan` を確認し、Cloudflare アカウントへインフラをデプロイします。

## 4. 本番リリース前に DB を決める

本番のデータが入ってから DB を替えると、データの移行も伴います。テンプレートは D1（SQLite）を使っているので、本番リリースの前に、1. でまとめたサービスの規模をもとに D1 のままでよいかを決めます。

- **規模で分かれる判断**:
  - 小規模なサービスなら D1 のままで困りません。
  - 行数や書き込みが多い大規模なサービスでは、下の制約に当たります。規模に応じて移行を検討します。
- **D1 の制約**:
  - 1 つの DB が単一スレッドで処理し、1 クエリの実行時間と DB の容量に上限があります。
  - SQLite の `ALTER TABLE` はできることが限られます。列の型変更や制約の追加では、drizzle-kit が表を作り直すマイグレーション（`__new_*` への全行コピー）を生成します。行の多い表でこれを流すと、書き込みのあいだ他のリクエストが待たされ、実行時間の上限にも当たります。
- **D1 で足りない見込みがある場合**:
  - Postgres のマネージドサービスを Alchemy で管理し、Workers から Hyperdrive 経由で繋ぐ構成が候補です。オンライン DDL、`CREATE INDEX CONCURRENTLY`、DB ブランチを使った本番相当のデータでのリハーサルなど、大きな表を止めずに変える手段が揃っています。
  - 移す場合の影響範囲、テスト用 DB に Testcontainers を使う理由、品質の定義は [issue #1387](https://github.com/masseater/typescript-template/issues/1387) にあります。

## 5. 本番リリース前に決済代行業者を決める

[契約](/data-model/billing) は支払い事業者の明細の写しではなく、[有料の案内](/pages/member-upgrade) の「契約する」の先で支払い事業者の手続きへ移ります。どの事業者へ移るかはテンプレートでは決めていないので、本番リリースの前に、1. でまとめた扱うデータの性質と規模をもとに決めます。決めた事業者の資格情報は 3. の GitHub Environment の secret に置き、必須キーに加えます。

- **判断の分かれ目**:
  - **課金の形**: 契約は月額・年額の継続課金を前提にしています。継続課金を事業者側のサブスクリプション機能に任せるか、自前で周期を管理して都度課金の API を呼ぶかで、事業者に求める機能が変わります。
  - **支払い手段**: カードだけで足りるか、コンビニ・銀行振込・キャリア決済・PayPay などのコード決済も要るか。継続課金でカード以外を使えるかは事業者ごとに違います。
  - **販売者と税の主体**: 自社が加盟店として販売者になるか、事業者が販売者になる MoR（merchant of record）を選ぶか。MoR は海外向けの消費税・VAT の徴収と納税を肩代わりしますが手数料が高く、国内向けの税務は自社に残ります。
  - **導入の速さと費用**: Web 申込で数日の審査、初期費用・月額固定費なしの事業者と、営業経由の個別見積もりで初期費用と月額固定費を払う事業者に分かれます。後者は取引額が大きいと手数料率で有利になります。
  - **開発体験**: REST API・Webhook・テスト環境がすぐ使えるか、ホスト型の決済ページや SDK があるか。契約の状態は Webhook で受け取って PlanSubscription に写すので、Webhook の署名検証と再送の仕様を確認します。
  - **不正利用対策**: 国内でカード決済を受ける EC 加盟店には EMV 3-D セキュアの導入が原則求められます（クレジットカード・セキュリティガイドライン）。事業者側で標準対応しているかを確認します。
- **候補**:
  - **グローバルの API 型**: Stripe（Billing で継続課金。日本ではコンビニ・銀行振込・PayPay にも対応）、Adyen、PayPal / Braintree、Square（Subscriptions API）。
  - **国内の API 型（初期費用・月額固定費なし、Web 審査）**: fincode byGMO、PAY.JP、KOMOJU（サブスクリプションはカードのみ）、UnivaPay、Opn Payments（旧 Omise）。
  - **国内の総合型（個別見積もり、決済手段が多く、大規模向け）**: GMO ペイメントゲートウェイ（PG マルチペイメントサービス）、SB ペイメントサービス、DG フィナンシャルテクノロジー（旧ベリトランス）、ソニーペイメントサービス、ROBOT PAYMENT（サブスクペイ）、ゼウス。
  - **MoR 型**: Paddle、Lemon Squeezy（Stripe が買収）、Stripe Managed Payments。
- **選び方の目安**:
  - 国内向けの小規模な会員制サービスで、カードだけで始めるなら、国内の API 型か Stripe で数日で始められます。
  - コンビニやキャリア決済が必須、または取引額が大きく手数料率を交渉したいなら、国内の総合型を営業経由で見積もります。
  - 海外の利用者へ販売し、各国の税務を持ちたくないなら、MoR 型を検討します。
