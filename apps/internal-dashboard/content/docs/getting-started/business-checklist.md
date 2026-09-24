---
title: ビジネス面のチェックリスト
description: コードの外側で、知らないと後から困る決めごとを場面ごとに並べる
---

テンプレートはコードと運用の仕組みを持ちますが、計測、集客、請求、法令、信頼のような事業の決めごとは持ちません。ここにあるのは、詳しい人がいないと存在に気づかず、後から困る項目です。[場面ごとにやること](/checklists) の場面に合わせて時間の順に並べ、各項目に何が起きるかと、テンプレートにすでにあるものと、決めた結果を書く場所を書きます。書く場所の多くは [事業の決めごと](/decisions/business) と [運用の決めごと](/decisions/operations) の節です。

- 例のリンクは代表例です。推奨ではありません。
- 法令の項目は概要です。該当するかどうかは公式の資料と専門家で確かめます。
- セッションリプレイと行動分析は [このテンプレートは何か](/getting-started/what-is-this) の「含まれていないもの」、決済代行業者は [最初の一歩](/getting-started/first-steps) にあります。

## 案が出たとき

場面: [案が出たとき](/checklists/idea)

- 業種ごとの許認可: マッチング（インターネット異性紹介事業）、人材紹介、古物、医療、金融などは、業種だけで届出や許可が要ります。サービスの形を決める前に確かめます。
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- ドメインとブランドの確保: 独自ドメイン、類似ドメイン、SNS のアカウント名、商標を先に押さえます。後から取られると買い戻しか改名になります。例: [J-PlatPat（商標検索）](https://www.j-platpat.inpit.go.jp/)
  - 書く場所: [事業の決めごと](/decisions/business#ドメインとアカウント)
- 管理アカウントの持ち主: ドメイン、クラウド、決済、広告、SNS のアカウントを個人ではなく法人の共有アカウントで持ちます。個人で持つと、担当者が抜けたときに止まります。
  - 書く場所: [事業の決めごと](/decisions/business#ドメインとアカウント)
- 事前登録とウェイトリスト: リリース前に需要を測り、初日の利用者を集めます。
  - 書く場所: [サービスの定義](/decisions/service#最初の公開の範囲)

## やると決めたとき

場面: [やると決めたとき](/checklists/commit)

- 電気通信事業の届出: 利用者間のメッセージのように他人の通信を媒介するサービスは、電気通信事業の届出が要ります。テンプレートの[メッセージ](/data-model/messaging)がそのまま当たりえます。例: [電気通信事業参入マニュアル（追補版）](https://www.soumu.go.jp/main_content/000477428.pdf)
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- 通信の秘密: 届出の有無にかかわらず、利用者間のメッセージの中身を運営が分析や広告に使うには、個別の明確な同意が要ります。
  - 書く場所: [プライバシーポリシー](/pages/member-privacy) の版
- 利用者間の送金とマーケットプレイス: 利用者同士でお金を動かすと、資金移動業や収納代行の論点が出ます。例: [Stripe Connect](https://stripe.com/jp/connect)
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- 本人確認（eKYC）: 法令や不正対策で本人確認が要る業種では、登録の流れに組み込みます。例: [TRUSTDOCK](https://biz.trustdock.io/)
  - 書く場所: [サービスの定義](/decisions/service#最初の公開の範囲)
- 多言語、タイムゾーン、通貨: 海外に出すかどうかを決めます。後から足すと、文言と日時と金額の扱いを全部見直します。
  - 書く場所: [サービスの定義](/decisions/service#最初の公開の範囲)

## リリースするとき（公開の前）

場面: [リリースするとき](/checklists/release)

### 計測

- アクセス解析: 流入元、ページビュー、離脱を見ます。無いと、リリース直後の施策の良し悪しを判断できません。例: [Google Analytics 4](https://marketingplatform.google.com/about/analytics/)、[Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)、[Plausible](https://plausible.io/)
  - 書く場所: 測定 ID は GitHub Environment の secret（キーは [使い始める手順](/getting-started/first-steps) の 3.）、見る人と見方は [事業の決めごと](/decisions/business#計測と集客)
- タグマネージャー: 計測や広告のタグを、コードを変えずに出し入れします。マーケティング担当が開発を待たずに済む一方で、CSP と外部送信規律で管理する送信先が増えます。例: [Google Tag Manager](https://tagmanager.google.com/)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- 流入元の記録（UTM）: どの施策から来たかを URL のパラメータで識別し、登録時にアカウントへ保存します。後から付けると、それまでの登録の流入元は取れません。
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- KPI の定義と見る場所: MRR、チャーン率、LTV、CAC、アクティブ率を、誰がどこで見るかを決めます。定義が人によって違うと議論が噛み合いません。例: [Metabase](https://www.metabase.com/)、[Looker Studio](https://lookerstudio.google.com/)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)

### 収益と会計

- 継続課金の運用: 支払いに失敗したときの再試行と督促（ダニング）、プラン変更の日割り、無料期間の終わり、クーポンを決めます。弱いと、気づかないまま売上を失います。テンプレートにあるもの: [契約](/data-model/billing)のデータモデル。
  - 書く場所: [事業の決めごと](/decisions/business#料金と請求)
- 料金の表示: 月額と年額、無料の範囲、税込の表示を決めます。消費者向けは総額表示が義務です。テンプレートにあるもの: [有料の案内](/pages/member-upgrade)。例: [国税庁 総額表示](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6902.htm)
  - 書く場所: [事業の決めごと](/decisions/business#料金と請求)
- 申込の最終確認画面と解約の導線: 2022 年 6 月の特定商取引法の改正で、申込の直前の画面に分量、価格、支払いの時期、解約の条件などの表示が必須になりました。解約を分かりにくくすると、違反やトラブルになります。例: [消費者庁 最終確認画面の表示](https://www.caa.go.jp/policies/policy/consumer_transaction/amendment/2021/notice02/index.html)
  - 書く場所: [有料の案内](/pages/member-upgrade) のページの仕様
- 返金の方針: 返金するか、日割りにするか、誰が決めるかを決めます。無いと、問い合わせのたびに対応が揺れます。
  - 書く場所: [事業の決めごと](/decisions/business#料金と請求)
- 領収書と請求書: 利用者が経費の精算に使います。
  - 書く場所: [事業の決めごと](/decisions/business#料金と請求)
- 電子帳簿保存法: 電子で受け取った、または発行した請求書や領収書は、電子のまま検索できる形で保存します。例: [国税庁 電子取引関係 一問一答](https://www.nta.go.jp/law/joho-zeikaishaku/sonota/jirei/07denshi/index.htm)
  - 書く場所: [事業の決めごと](/decisions/business#料金と請求)
- チャージバックと不正利用: カードの不正利用は、売上の取り消しに加えて手数料も事業者の負担です。例: [Stripe Radar](https://stripe.com/jp/radar)
  - 書く場所: [事業の決めごと](/decisions/business#料金と請求)

### 法令と規約

- 利用規約とプライバシーポリシー: 本文に加えて、改定したときの再同意まで要ります。テンプレートにあるもの: [規約の版](/glossary/agreement-version)と[同意の記録](/glossary/agreement-acceptance)。
  - 書く場所: [管理者アプリの規約](/pages/admin-terms) で公開する版
- 特定商取引法に基づく表記: 有料で売るなら、事業者名、所在地、電話番号、返品の条件などの表示が必須です。例: [特定商取引法ガイド 通信販売](https://www.no-trouble.caa.go.jp/what/mailorder/)
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- 個人情報保護法: 利用目的の明示、第三者提供の同意、開示の請求への対応を用意します。テンプレートにあるもの: [退会の申請](/glossary/leave-request)。例: [個人情報保護委員会 法令とガイドライン](https://www.ppc.go.jp/personalinfo/legal/)
  - 書く場所: [プライバシーポリシー](/pages/member-privacy) の版
- 投稿の権利: 利用者の投稿を運営が使える範囲を規約で決めます。
  - 書く場所: 利用規約の版（[管理者アプリの規約](/pages/admin-terms) で公開する版）
- 未成年の利用: 年齢の制限、法定代理人の同意、課金の上限を決めます。未成年の契約は取り消されえます。
  - 書く場所: 利用規約の版（[管理者アプリの規約](/pages/admin-terms) で公開する版）
- アクセシビリティ: 2024 年 4 月から、事業者にも障害のある人への合理的配慮の提供が義務になりました。Web は WCAG が基準です。例: [内閣府 合理的配慮の提供の義務化](https://www8.cao.go.jp/shougai/suishin/sabekai_leaflet-r05.html)、[WCAG 2.2](https://www.w3.org/TR/WCAG22/)
  - 書く場所: [サービスの定義](/decisions/service#品質の定義)
- OSS ライセンスの表示: 依存するライブラリのライセンスの表記と、再配布の条件を確かめます。
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- AI 機能の扱い: LLM に送るデータの範囲、学習に使われない契約、AI が作ったことの表示を決めます。テンプレートにあるもの: [インタビューシート](/glossary/interview-sheet)。例: [AI 事業者ガイドライン](https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/index.html)
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)

### セキュリティと信頼

- メールの送信ドメイン認証: SPF、DKIM、DMARC が無いと、大手のメールサービスに届きません。例: [Gmail 送信者のガイドライン](https://support.google.com/a/answer/81126)
  - 書く場所: 送信ドメインの DNS。どのレコードをどこで管理するかを [運用の決めごと](/decisions/operations#セキュリティ) に書きます
- 漏えい時の報告: 個人データの漏えいとそのおそれは、個人情報保護委員会へ速報をおおむね 3〜5 日以内、確報を 30 日以内に出し、本人に知らせます。メールの誤送信 1 件でも当たりえます。手順を先に決めておきます。例: [個人情報保護委員会 漏えい等の対応](https://www.ppc.go.jp/personalinfo/legal/leakAction/)
  - 書く場所: [運用の決めごと](/decisions/operations#漏えいの対応)
- 脆弱性診断: 公開前と大きな変更の後に、第三者に診てもらいます。
  - 書く場所: [運用の決めごと](/decisions/operations#セキュリティ)
- バックアップと復旧の目標: どこまで戻せればよいか（RPO）と、何時間で戻すか（RTO）を決め、実際に戻してみます。例: [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
  - 書く場所: [運用の決めごと](/decisions/operations#バックアップと復旧)
- 監査ログ: 運用者が誰の何を見て変えたかを残します。テンプレートにあるもの: [監査イベント](/glossary/audit-event)。
  - 書く場所: [運用の決めごと](/decisions/operations#権限)

### 運用とサポート

- 問い合わせの窓口: 件数が増えたら外部のツールに移します。テンプレートにあるもの: [問い合わせ](/glossary/inquiry)。例: [Zendesk](https://www.zendesk.com/)、[Intercom](https://www.intercom.com/)
  - 書く場所: [運用の決めごと](/decisions/operations#問い合わせ)
- よくある質問とヘルプ: 同じ問い合わせを減らします。
  - 書く場所: [運用の決めごと](/decisions/operations#問い合わせ)
- ステータスページ: 障害を知らせる場所です。無いと、障害のたびに問い合わせが集まり、SNS で憶測が広がります。例: [Instatus](https://instatus.com/)、[Better Stack](https://betterstack.com/status-page)
  - 書く場所: [運用の決めごと](/decisions/operations#障害の連絡)
- 外形監視と呼び出し: 外から定期的にアクセスし、落ちていたら担当者を呼びます。テンプレートにあるもの: [SLI と SLO](/observability/sli-slo)の計測。例: [Better Stack](https://betterstack.com/)、[PagerDuty](https://www.pagerduty.com/)
  - 書く場所: [運用の決めごと](/decisions/operations#障害の連絡)
- クラウドの費用の監視: 想定外の課金を早く止めます。
  - 書く場所: [サービスの定義](/decisions/service#予算)

## リリースするとき（公開の日）

場面: [リリースするとき](/checklists/release)

- 検索エンジン向けの設定: sitemap.xml、robots.txt、canonical、構造化データを用意します。無いと検索に載らないか、重複として扱われます。公開の前に外す検索エンジン向けの設定は [最初の一歩](/getting-started/first-steps) にあります。例: [Google 検索セントラル](https://developers.google.com/search/docs)、[schema.org](https://schema.org/)
  - 書く場所: `libs/runtime/src/features/runtime/responses.ts`
- 検索エンジンの管理ツール: 検索での表示回数、インデックスの状況、手動の対策の通知を受け取ります。例: [Google Search Console](https://search.google.com/search-console/about)、[Bing Webmaster Tools](https://www.bing.com/webmasters/)
  - 書く場所: [事業の決めごと](/decisions/business#ドメインとアカウント)
- OGP: SNS で共有されたときの画像とタイトルです。無いと、リンクが素の URL で表示されます。例: [The Open Graph protocol](https://ogp.me/)
  - 書く場所: [LP](/pages/member-lp) のページの仕様
- 表示の速さ: 検索の順位と離脱率を左右します。テンプレートにあるもの: [Web Performance API](/observability/web-performance-api) の計測。
  - 書く場所: [サービスの定義](/decisions/service#品質の定義)
- ボット対策: 登録、ログイン、問い合わせへの自動の送信を止めます。無いと、スパムの登録やメールの悪用で送信元の評判が落ちます。例: [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/)
  - 書く場所: [運用の決めごと](/decisions/operations#セキュリティ)
- レート制限と WAF: 総当たり、スクレイピング、DDoS に備えます。例: [Cloudflare WAF](https://developers.cloudflare.com/waf/)
  - 書く場所: [運用の決めごと](/decisions/operations#セキュリティ)
- 脆弱性の報告窓口: 外部の人が脆弱性を知らせる先です。無いと、SNS で公開されてから知ります。例: [security.txt](https://securitytxt.org/)
  - 書く場所: [運用の決めごと](/decisions/operations#セキュリティ)

## 施策を足すとき

場面: [変更や問題が起きたとき](/checklists/change)

- 外部に送るタグを入れるとき（外部送信規律）: 2023 年 6 月から、解析や広告のタグで利用者の情報を外部に送るときは、送信先と目的の公表などが要ります。GA を入れた時点で当たりえます。例: [総務省 外部送信規律](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu.html)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客) と [プライバシーポリシー](/pages/member-privacy) の版
- 海外のサービスに個人データを渡すとき: 解析、メール配信、LLM などの海外のサービスに個人データを渡すと、外国にある第三者への提供として同意か情報提供が要ります。例: [外国にある第三者への提供編](https://www.ppc.go.jp/personalinfo/legal/guidelines_offshore/)
  - 書く場所: [プライバシーポリシー](/pages/member-privacy) の版
- 広告を出すとき: 広告経由の登録や購入を広告の媒体へ返す計測を入れます。無いと、媒体の自動の最適化が働かず、費用対効果も測れません。例: [Google 広告のコンバージョン トラッキング](https://support.google.com/google-ads/answer/1722022)、[Meta コンバージョン API](https://developers.facebook.com/docs/marketing-api/conversions-api)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- 広告や口コミを依頼するとき（ステマ規制）: 2023 年 10 月から、事業者が関わる投稿で広告と分からないものは景品表示法の違反です。例: [消費者庁 ステルスマーケティング](https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- LP やキャンペーンを作るとき: 「No.1」「最安」の根拠と、景品の額の上限を確かめます。例: [消費者庁 景品表示法](https://www.caa.go.jp/policies/policy/representation/fair_labeling)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- 宣伝のメールを送るとき（特定電子メール法）: 事前の同意とその記録、配信停止の手段、送信者の表示が必須です。取引のメールと同じ送信元で送ると、迷惑メールの判定が取引のメールにも及びます。例: [特定電子メールの送信等に関するガイドライン](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/pdf/m_mail_081114_1.pdf)、[Brevo](https://www.brevo.com/)、[Loops](https://loops.so/)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- 投稿を公開するとき（情報流通プラットフォーム対処法）: 削除の申出と発信者情報の開示請求に対応します。大規模な事業者には窓口と期限の義務があります。テンプレートにあるもの: [通報](/glossary/report)と[モデレーション](/glossary/moderation-action)。例: [総務省 情報流通プラットフォーム対処法](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/ihoyugai.html)
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- 有償のポイントを出すとき（資金決済法）: 買えるポイントやコインは前払式支払手段に当たり、未使用の残高が基準日に 1,000 万円を超えると届出と供託が要ります。例: [金融庁 前払式支払手段発行者の様式](https://www.fsa.go.jp/common/shinsei/maebaraishiki.html)
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- 紹介に報酬を付けるとき: 景品表示法の景品の規制に当たります。テンプレートにあるもの: [招待](/glossary/invite)。
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)
- 海外に売るとき: 各国の消費税と VAT の登録と納付、EU と英国の Cookie の同意が要ることがあります。例: [Cookiebot](https://www.cookiebot.com/)、[Klaro!](https://github.com/klaro-org/klaro-js)
  - 書く場所: [事業の決めごと](/decisions/business#法令と届出)

## 企業に売る前

場面: 企業に売ると決めた時点で、[やると決めたとき](/checklists/commit) に足します。

- インボイス制度: 企業の顧客は、登録番号のある適格請求書が無いと仕入税額控除を受けられません。例: [国税庁 インボイス制度](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/invoice.htm)
  - 書く場所: [事業の決めごと](/decisions/business#企業に売る条件)
- セキュリティの認証とチェックシート: 導入の審査で、ISMS（ISO/IEC 27001）、SOC 2、プライバシーマークや、数百問のチェックシートへの回答を求められます。認証の取得には数か月かかります。例: [ISMS-AC](https://isms.jp/)、[プライバシーマーク](https://privacymark.jp/)
  - 書く場所: [事業の決めごと](/decisions/business#企業に売る条件)
- SSO と SCIM: 企業は社員のアカウントを自社の IdP で管理し、入社と退社に合わせて自動で追加と削除をしたがります。無いと、大きな企業の導入で止まります。例: [WorkOS](https://workos.com/)
  - 書く場所: [サービスの定義](/decisions/service#最初の公開の範囲)
- 組織と権限: 1 つの契約に複数の利用者、管理者と一般の区別、席数での課金を用意します。テンプレートにあるもの: [グループ](/glossary/group)。
  - 書く場所: [サービスの定義](/decisions/service#最初の公開の範囲)
- SLA: 稼働率を約束するか、下回ったら返金するかを決めます。
  - 書く場所: [事業の決めごと](/decisions/business#企業に売る条件)
- 解約時のデータ: データの返却と削除の証明を求められます。
  - 書く場所: [事業の決めごと](/decisions/business#企業に売る条件)
- 見込み客の管理: 営業が表計算で管理を始めると、後から移せません。例: [HubSpot](https://www.hubspot.com/)、[Salesforce](https://www.salesforce.com/)
  - 書く場所: [事業の決めごと](/decisions/business#ドメインとアカウント)
- 契約書と電子署名: 個別の契約と NDA を交わします。例: [クラウドサイン](https://www.cloudsign.jp/)
  - 書く場所: [事業の決めごと](/decisions/business#ドメインとアカウント)

## 規模が出てから

場面: [定期的に見るとき](/checklists/periodic)

- 製品分析とセッションリプレイ: [このテンプレートは何か](/getting-started/what-is-this) の「含まれていないもの」にあります。
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- A/B テスト: 出し分けに加えて、割り付けと効果の検定が要ります。テンプレートにあるもの: [機能フラグ](/glossary/feature-flag)。例: [GrowthBook](https://www.growthbook.io/)、[Statsig](https://www.statsig.com/)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- 分析用のデータの複製: 本番の DB で集計すると本番が遅くなります。分析用の置き場に複製します。例: [BigQuery](https://cloud.google.com/bigquery)、[R2 Data Catalog](https://developers.cloudflare.com/r2/data-catalog/)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- 利用者の声: NPS、アンケート、解約の理由を集めます。解約の理由を取らないと、チャーンの原因が分かりません。例: [Typeform](https://www.typeform.com/)
  - 書く場所: [事業の決めごと](/decisions/business#計測と集客)
- 会計ソフトとの連携: 決済代行業者からの入金を、どの売上の分かに割り当てます（入金消込）。手作業だと月末に回らなくなります。例: [freee 会計](https://www.freee.co.jp/)、[マネーフォワード クラウド](https://biz.moneyforward.com/)
  - 書く場所: [事業の決めごと](/decisions/business#料金と請求)
- 障害の報告: 障害の後に、原因と再発の防止を利用者へ報告する形を決めます。
  - 書く場所: [運用の決めごと](/decisions/operations#障害の連絡)
- 契約中の外部サービスの棚卸し: 誰がどの支払い手段で何を契約しているかをまとめます。無いと、解約し忘れたサービスと、担当者が抜けたときに止まるサービスが出ます。
  - 書く場所: [事業の決めごと](/decisions/business#ドメインとアカウント)
- メール以外の通知: プッシュ通知と SMS です。SMS を認証に使うと費用が大きくなります。テンプレートにあるもの: [通知](/glossary/notification)。例: [Twilio](https://www.twilio.com/)
  - 書く場所: 変更の issue
