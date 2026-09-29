# SPEC.md

最小構成の Web アプリを量産するためのテンプレートである。

## 要求

- 必須技術を使っていなければ、ガイドではなく検査が失敗する。
- ハーネスは、より厳しい手段を Claude が自ら調べて適用できる構成とする。
- 要求はあえて曖昧に書く。ただし完了時には検証できる形にする。
- テストと CI は持たない。RC や beta のバージョンも許容する。

## 技術

- TypeScript 7、effect、@effect/tsgo
- Vite+ によるモノレポ
- TanStack Start、ElysiaJS と Eden、TanStack Query
- effect-atom
- shadcn/ui
- Feature-Sliced Design
- better-auth
- Drizzle
- OpenFeature
- OpenTelemetry
- Cloudflare Workers と D1、Alchemy
- oxlint、oxfmt、fallow、steiger、textlint
- Renovate
