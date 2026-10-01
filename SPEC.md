# SPEC.md

最小構成のWebアプリを量産するためのテンプレートである。

## 要求

必須技術を使っていなければ、検査が失敗する。ガイドに書くだけでは強制しない。
ハーネスは、より厳しい手段をClaudeが自ら調べて適用できる構成とする。
要求はあえて曖昧に書く。ただし完了時には検証できる形にする。
テストは持たない。CIはGitHub Actionsで検証だけを走らせる。RCやbetaのバージョンも許容する。

## 技術

言語はTypeScript 7で、effectと@effect/tsgoを使う。
リポジトリはVite+によるモノレポである。
アプリはTanStack Startで組み、APIはElysiaJSとEden、サーバー状態はTanStack Queryで扱う。
UI状態はeffect-atom、UIはshadcn/ui、構成はFeature-Sliced Designに従う。
認証はbetter-auth、データベースアクセスはDrizzle、機能フラグはOpenFeature、計測はOpenTelemetryを使う。
デプロイ先はCloudflare WorkersとD1で、Alchemyで定義する。
検査にはoxlint、oxfmt、fallow、steiger、textlint、yomiyasuを使う。
依存の更新はRenovateで行い、CIが通ったものだけを自動でマージする。
