---
title: Base UI と shadcn
description: 挙動は Base UI、見た目の部品はこのリポジトリの libs/ui が持つ
---

画面の部品は 2 段です。挙動と、見た目をこのリポジトリが持つことと、を分けています。

## Base UI は挙動だけを持つ

Base UI（`@base-ui/react`）は、見た目を持たない挙動です。ボタンが無効になること、メニューがキーボードで開くこと、ダイアログがフォーカスを閉じ込めることを、部品が担当します。`libs/ui` の `Button` は `@base-ui/react/button` を包み、クラス名だけを足しています。チェックボックス、メニュー、トースト、確認ダイアログも同じ形で、対応する Base UI の部品を包んでいます。

## shadcn の部品はリポジトリの中にある

shadcn は、その挙動の上に載せる部品を、依存パッケージのまま黒箱で使うのではなく、このリポジトリの中へ置いて持つやり方です。実体は `libs/ui/src/shared/ui` にあり、見た目は Tailwind CSS のクラスと CSS 変数です。どの style から始めたかは `libs/ui/components.json` の `base-vega` が持っています。

画面が import するのは `@repo/ui` です。Base UI を import しているのは `libs/ui` の部品です。色、角丸、影、文字は部品側が持ち、画面は余白のようにレイアウトだけを足します。この境界を外から変えることは `@shadcn/lint` が見ます。部品を足すときの判断は [フロントエンド](/guidelines/frontend) です。
