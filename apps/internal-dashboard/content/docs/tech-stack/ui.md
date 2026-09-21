---
title: Base UI と shadcn
description: 挙動は Base UI が持ち、見た目の部品はリポジトリ内に保持する
---

画面の部品は、挙動と見た目で層が分かれる。

Base UI（`@base-ui/react`）は見た目を持たない。ボタンの無効化、メニューのキーボード操作、ダイアログが開いているあいだフォーカスをその中に保つことを、部品が行う。画面は、その部品にクラス名を付けて使う。

shadcn は、部品をパッケージの公開 API として依存せず、ソースをリポジトリへコピーして保持する方式である。コピーしたソースを直接編集できる。見た目は Tailwind CSS のクラスと CSS 変数で定義する。色、角丸、影、文字は部品側のクラスが持ち、画面が指定するのは余白のようなレイアウトだけである。

部品を追加するときの判断は [フロントエンド](/guidelines/frontend) にある。

## 参考文献

- 公式 — [Base UI](https://base-ui.com/)
- 公式 — [Overview](https://base-ui.com/react/overview)
- 公式 — [Button](https://base-ui.com/react/components/button)
- 公式 — [shadcn/ui](https://ui.shadcn.com/docs)
- 公式 — [components.json](https://ui.shadcn.com/docs/components-json)
- 公式 — [TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)（shadcn を TanStack Start へ導入する）
- サンプル — [shadcn/create](https://ui.shadcn.com/create)
- 記事 — [July 2026 - Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
