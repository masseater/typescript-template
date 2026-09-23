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

本番のデータが入ってから DB を替えると、データの移行も伴います。テンプレートは [D1](https://developers.cloudflare.com/d1/)（SQLite）を使っているので、本番リリースの前に、1. でまとめたサービスの規模をもとに D1 のままでよいかを決めます。

- **規模で分かれる判断**:
  - 小規模なサービスなら D1 のままで困りません。
  - 行数や書き込みが多い大規模なサービスでは、下の制約に当たります。規模に応じて移行を検討します。
- **D1 の制約**:
  - 1 つの DB が単一スレッドで処理し、1 クエリの実行時間と DB の容量に上限があります。
  - SQLite の `ALTER TABLE` はできることが限られます。列の型変更や制約の追加では、[drizzle-kit](https://orm.drizzle.team/docs/kit-overview) が表を作り直すマイグレーション（`__new_*` への全行コピー）を生成します。行の多い表でこれを流すと、書き込みのあいだ他のリクエストが待たされ、実行時間の上限にも当たります。
- **D1 で足りない見込みがある場合**:
  - Postgres のマネージドサービスを Alchemy で管理し、Workers から [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) 経由で繋ぐ構成が候補です。オンライン DDL、`CREATE INDEX CONCURRENTLY`、DB ブランチを使った本番相当のデータでのリハーサルなど、大きな表を止めずに変える手段が揃っています。
  - 移す場合の影響範囲、テスト用 DB に [Testcontainers](https://testcontainers.com/) を使う理由、品質の定義は [issue #1387](https://github.com/masseater/typescript-template/issues/1387) にあります。

## 5. 本番リリース前に決済代行業者を決める

[契約](/data-model/billing) は支払い事業者の明細の写しではなく、[有料の案内](/pages/member-upgrade) の「契約する」の先で支払い事業者の手続きへ移ります。どの事業者へ移るかはテンプレートでは決めていないので、本番リリースの前に、1. でまとめた扱うデータの性質と規模をもとに決めます。決めた事業者の資格情報は 3. の GitHub Environment の secret に置き、必須キーに加えます。

- **判断の分かれ目**:
  - **課金の形**: 契約は月額・年額の継続課金を前提にしています。継続課金を事業者側のサブスクリプション機能に任せるか、自前で周期を管理して都度課金の API を呼ぶかで、事業者に求める機能が変わります。
  - **支払い手段**: カードだけで足りるか、コンビニ・銀行振込・キャリア決済・PayPay などのコード決済も要るか。継続課金でカード以外を使えるかは事業者ごとに違います。
  - **販売者と税の主体**: 自社が加盟店として販売者になるか、事業者が販売者になる MoR（merchant of record）を選ぶか。MoR は海外向けの消費税・VAT の徴収と納税を肩代わりしますが手数料が高く、国内向けの税務は自社に残ります。
  - **導入の速さと費用**: Web 申込で数日の審査、初期費用・月額固定費なしの事業者と、営業経由の個別見積もりで初期費用と月額固定費を払う事業者に分かれます。後者は取引額が大きいと手数料率で有利になります。
  - **開発体験**: REST API・Webhook・テスト環境がすぐ使えるか、ホスト型の決済ページや SDK があるか。契約の状態は Webhook で受け取って PlanSubscription に写すので、Webhook の署名検証と再送の仕様を確認します。
  - **不正利用対策**: 国内でカード決済を受ける EC 加盟店には EMV 3-D セキュアの導入が原則求められます（日本クレジット協会の[クレジットカード・セキュリティガイドライン](https://www.j-credit.or.jp/security/)）。事業者側で標準対応しているかを確認します。
  - **販売先**: 個人（toC）だけか、企業（toB）や官公庁・自治体（toG）にも売るか。toB では請求書払い（掛け払い）・銀行振込・口座振替と、与信・督促・入金消込を事業者に任せられるかが分かれ目です。toG では収納側が公金の扱いになるため、公金収納に対応した事業者か、請求書を発行して振込を受ける形になります。
- **候補**（toB は請求書払い・掛け払い・口座振替、toG は公金収納への対応を書いています）:
  - **グローバルの API 型**:
    - **[Stripe](https://stripe.com/jp)**: [Billing](https://stripe.com/jp/billing) で継続課金、[Invoicing](https://stripe.com/jp/invoicing) で請求書、[Tax](https://stripe.com/jp/tax) で税計算まで 1 つの API で揃います。日本ではカードのほかコンビニ・[銀行振込](https://docs.stripe.com/payments/bank-transfers)・PayPay に対応し、銀行振込は顧客ごとの仮想口座で入金を自動で消し込みます。toB は請求書払いと銀行振込で対応できます。toG の公金収納の実績は確認できていません。
    - **[Adyen](https://www.adyen.com/ja_JP/)**: 単一の API と契約で世界中の決済手段を扱い、オンラインと対面を同じ基盤で処理します。日本ではカード・コンビニ・PayPay に対応し、精算が日次に近い速さです。大規模・多国展開の事業者向けで、営業経由の契約です。toB・toG 向けの機能は確認できていません。
    - **[PayPal](https://www.paypal.com/jp/business)**: 利用者が PayPal アカウントで支払う形で、カード番号を預からずに済みます。定期支払いに対応します。[Braintree](https://www.paypal.com/us/braintree) は日本の事業者には提供されていません。toB・toG 向けの機能は確認できていません。
    - **[Square](https://squareup.com/jp/ja)**: 対面の POS レジと同じアカウントでオンライン決済・請求書・継続課金を使え、初期費用・月額固定費なしで始められます。[Subscriptions API](https://developer.squareup.com/docs/subscriptions-api/overview) があります。店舗とオンラインを 1 つの売上で見たい事業者向けです。toB は請求書で対応できます。toG 向けの機能は確認できていません。
  - **国内の API 型（初期費用・月額固定費なし、Web 申込で数日の審査）**:
    - **[fincode byGMO](https://www.fincode.jp/)**: GMO ペイメントゲートウェイ系のスタートアップ向けサービスで、PG マルチペイメントサービスとは別の製品です。REST API・SDK・UI コンポーネントとテスト環境が申込直後から使え、サブスクリプション機能を持ちます。toB・toG の機能は fincode 自体には無く、GMO 系の別サービスを組み合わせる形です。
    - **[PAY.JP](https://pay.jp/)**: カード決済に絞ったシンプルな API で、[定期課金](https://docs.pay.jp/v1/subscription)は追加費用なしで使えます。Visa・Mastercard は数営業日で本番審査が終わります。カード以外の手段は持たないので、コンビニなどが要るなら他と組み合わせます。toB・toG 向けの機能は確認できていません。
    - **[KOMOJU](https://ja.komoju.com/)**: カード・コンビニ・PayPay など国内外の手段を 1 つの API で扱え、REST API と Webhook があり日本語サポートがあります。サブスクリプションは支払いリンク機能でカードのみです。toB・toG 向けの機能は確認できていません。
    - **[UnivaPay](https://univapay.com/)**: カード・銀行振込・コンビニに加えて国内 6 種の QR 決済と Alipay・WeChat Pay などの海外ウォレットに対応し、オンラインと対面の両方を扱います。継続課金と分割払いを持ちます。訪日客や中華圏向け販売がある事業者向けです。toB・toG 向けの機能は確認できていません。
    - **[Opn Payments](https://www.opn.ooo/jp-ja/)（旧 Omise）**: アジアで展開する事業者で、カード・Google Pay・QR 決済に対応し、継続課金・支払いリンク・埋め込み決済を持ちます。日本版は円建てのみで、キャリア決済は持ちません。toB・toG 向けの機能は確認できていません。
  - **国内の総合型（営業経由の個別見積もり、初期費用と月額固定費あり、決済手段が多い）**:
    - **[GMO ペイメントゲートウェイ](https://www.gmo-pg.com/)（[PG マルチペイメントサービス](https://www.gmo-pg.com/service/mulpay/)）**: 国内最大手で、カード・コンビニ・キャリア決済・QR など 30 種を超える手段を一括で導入でき、大規模トランザクションに耐えます。toB は同グループの [GMO 掛け払い](https://www.gmo-ps.com/)（与信・請求書発行・入金確認・督促の代行、未回収リスクの負担）があります。toG は[自治体・公共機関向けの決済サービス](https://www.gmo-pg.com/service/government/)（税金・水道料金・施設利用料の収納）があります。
    - **[SB ペイメントサービス](https://www.sbpayment.jp/)**: ソフトバンクグループの決済事業者で、通信事業を支える処理能力と、ソフトバンクまとめて支払いなどキャリア決済に強みがあります。継続課金は簡易型と定期・従量型があります。toB は [NP 掛け払い](https://np-kakebarai.com/)など提携先の掛け払いを使います。toG は自治体の指定決済事業者としての導入事例があります。
    - **[DG フィナンシャルテクノロジー](https://www.dgft.jp/)（VeriTrans4G、旧ベリトランス）**: カード・コンビニ・キャリア決済・ID 決済に加え PayPal や Alipay など国際決済も一括で導入でき、EMV 3-D セキュアを標準で持ちます。継続課金に対応します。toB・toG は Pay-easy を使った[銀行決済](https://www.veritrans.co.jp/payment/bank/)に強みがあり、教育・自治体・BtoB への導入実績と、国の手数料納付へのカード決済提供の実績があります。
    - **[SP.LINKS](https://www.splinks.co.jp/)（e-SCOTT Smart、2025 年 10 月にソニーペイメントサービスから社名変更）**: カード会社と直接接続し、応答の速さと稼働率を売りにします。カード情報が販売サイトを通らない方式で、カードとコンビニを扱います。toB は[マネーフォワード ケッサイ](https://mfkessai.co.jp/)と連携した掛け払い（与信から督促までの代行）があります。toG 向けの機能は確認できていません。
    - **[ROBOT PAYMENT](https://www.robotpayment.co.jp/)（[サブスクペイ](https://www.robotpayment.co.jp/service/payment/)）**: サブスクリプション事業に特化した顧客管理と自動決済で、カード・口座振替・銀行振込を扱います。toB は[請求管理ロボ](https://www.robotpayment.co.jp/service/mikata/)（請求書発行・債権管理）と [RP 掛け払い](https://www.robotpayment.co.jp/service/payment/btob_kakebarai/)（売掛金の全額保証）を持ち、toB のサブスクリプションに最も寄っています。toG 向けの機能は確認できていません。
    - **[ゼウス](https://www.cardservice.co.jp/)**: カード・コンビニ・銀行振込を扱う老舗の決済代行で、EC カート各社との連携が多いです。toB は [Biz ケッサイ](https://www.cardservice.co.jp/biz/)（Biz クレカ・Biz 入金消込・Biz 口振）として、カード・銀行振込の入金消込・口座振替を企業間取引向けに揃えています。toG 向けの機能は確認できていません。
  - **MoR 型（事業者が販売者になり、海外の税務を肩代わりする）**:
    - **[Paddle](https://www.paddle.com/)**: SaaS 向けで、席数課金・見積・発注書（PO）・請求書払いの支払期限など toB の請求に対応します。手数料は API 型より高く、日本の事業者向けの国内税務は自社に残ります。toG 向けの機能は確認できていません。
    - **[Lemon Squeezy](https://www.lemonsqueezy.com/)**: デジタル商品や小口のサブスクリプション向けで、ストアフロントとメール配信を同梱します。2024 年に Stripe が買収し、Stripe の MoR 機能へ統合が進んでいます。toB・toG 向けの機能は確認できていません。
    - **[Stripe Managed Payments](https://docs.stripe.com/payments/managed-payments)**: Stripe 上で MoR を選べる形で、日本の事業者も使えますが、日本国内向けの税務は対象外です。toB は Stripe と同じです。
  - **公金収納に特化**:
    - **[F-REGI 公金支払い](https://www.f-regi.com/koukin/)**: 自治体・国の税金や手数料をカード・Pay-easy・QR 決済で収納する専門事業者で、460 を超える自治体と地方税共同機構・国税庁への提供実績があります。toG の収納だけが目的なら、総合型より先に候補になります。toC・toB の一般の決済には向きません。
- **選び方の目安**:
  - 国内向けの小規模な会員制サービスで、カードだけで始めるなら、国内の API 型か Stripe で数日で始められます。
  - コンビニやキャリア決済が必須、または取引額が大きく手数料率を交渉したいなら、国内の総合型を営業経由で見積もります。
  - 海外の利用者へ販売し、各国の税務を持ちたくないなら、MoR 型を検討します。
  - 企業に請求書払いで売るなら、Stripe の請求書と銀行振込か、掛け払いを代行する国内の総合型（GMO 掛け払い、RP 掛け払い、Biz ケッサイ、マネーフォワード ケッサイ連携）を比べます。
  - 官公庁・自治体から収納するなら、公金収納の実績がある GMO ペイメントゲートウェイ・SB ペイメントサービス・DG フィナンシャルテクノロジーか、F-REGI 公金支払いを比べます。
