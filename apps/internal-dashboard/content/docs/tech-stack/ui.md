---
title: Base UI と shadcn
description: 挙動は Base UI、見た目の部品はリポジトリの中に置く
---

画面の部品は 2 段です。挙動と、見た目をリポジトリが持つことと、を分けています。

Base UI（`@base-ui/react`）は、見た目を持たない挙動です。ボタンが無効になること、メニューがキーボードで開くこと、ダイアログがフォーカスを閉じ込めることを、部品が担当します。画面はクラス名を足して、その挙動を包みます。

shadcn は、その挙動の上に載せる部品を、依存パッケージのまま黒箱で使うのではなく、リポジトリの中へ置いて持つやり方です。見た目は Tailwind CSS のクラスと CSS 変数です。色、角丸、影、文字は部品側が持ち、画面は余白のようにレイアウトだけを足します。

部品を足すときの判断は [フロントエンド](/guidelines/frontend) です。

## 公式と読みもの

- 挙動の公式は [Base UI](https://base-ui.com/) です。最初に読むなら [Overview](https://base-ui.com/react/overview) と [Button](https://base-ui.com/react/components/button) です。
- 部品の置き方の公式は [shadcn/ui](https://ui.shadcn.com/docs) です。設定ファイルの意味は [components.json](https://ui.shadcn.com/docs/components-json)、TanStack Start への足し方は [TanStack Start のインストール](https://ui.shadcn.com/docs/installation/tanstack) にあります。
- 見た目の組み合わせをブラウザで組むなら [shadcn/create](https://ui.shadcn.com/create) です。
- Base UI を既定にした理由は [July 2026 - Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) にあります。
