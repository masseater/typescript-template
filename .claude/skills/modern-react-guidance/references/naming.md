# 名前とファイル

大本: https://gist.github.com/rafaelrozon/9fd6bc9efbce3e70311b364f87b89241

出典は 2019 年の React/Redux 向け命名表である。このリポジトリでは Redux・`.jsx`・`.story.js`・`*Screen` は採らない。下の表が拘束である。

## 識別子

| 対象 | 形式 | 例 |
| --- | --- | --- |
| コンポーネント | PascalCase | `Button`、`LoginPage`、`LoginModal` |
| ページ部品 | `[Name]Page`（`Screen` 接尾辞は使わない） | `LoginPage` |
| 定数 | `SCREAMING_SNAKE` | `DEFAULT_STATE`、`MAX_PAGES_WITHOUT_GAPS` |
| Story の export | バリアント名（`[Feature]Stories` モジュール名は使わない） | `Primary`、`Disabled` |

## ファイル

| 対象 | 形式 | 例 |
| --- | --- | --- |
| ソース | kebab-case の `.ts` / `.tsx`（`.jsx` は拒否） | `login-page.tsx`、`button.tsx` |
| Storybook | `*.stories.tsx`（`.story.js` は使わない） | `button.stories.tsx` |
| テスト | `*.test.ts` / `*.test.tsx` / `*.worker.test.ts` | `action-gate.test.ts` |
| ロケール | 言語コードの JSON（`language_territory` 形式は使わない） | `en.json`、`ja.json` |

アプリの `src/` は FSD の `app` / `pages` / `widgets` / `features` / `entities` / `shared` だけ。`project/layers` と steiger が検査する。ページは `pages/<slice>/ui/*-page.tsx`、クエリは `api` セグメント。

## 採らない出典

| 出典 | 代わり |
| --- | --- |
| Action Type / Action Creator / Reducer / Selector | Effect Atom、`useAction`、TanStack Query。Redux 系パッケージは `project/retired-imports` / `project/atom-state` が拒否する |
| `*Reducer.js` / `*Actions.js` / `*Selectors.js` / `*Types.js` | FSD の `model` / `api` / `ui` |
| CSS クラスを手で kebab 設計する | Tailwind ユーティリティと `cva`。`@shadcn/lint` |
| `[ScreenName]Screen` | `[Name]Page` |

見た目のクラス名を部品の外で足さない。トークンと `data-slot` は既存の `libs/ui` に合わせる。props の形は `component-apis.md`。
