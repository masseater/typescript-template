# フロントエンド

## コンポーネントと仕様の置き場所

- UI のコンポーネントは `libs/ui` の基礎（`libs/ui/package.json` が持つ React、shadcn、Tailwind CSS）の上に載せる。
- アプリ固有の画面組み立ては各アプリの FSD 境界の内側に置き、共通にできる見た目だけを `libs/ui` へ切り出す。
- 外部の UI キットのデモやブロック集を、依存や規範の根拠にしない。
- 画面の構成と遷移の判断は `apps/internal-dashboard/content/docs/pages/` に置く。references に混ぜない。

## サーバー状態と UI 状態

- サーバーにある事実（一覧、詳細、権限、集計）は TanStack Query の `useQuery` が取得とキャッシュを担う。`fetch` の結果や応答を Effect Atom や `useState` に写さない。
- `queryOptions`・`infiniteQueryOptions`・`mutationOptions` は FSD の `api` セグメントで宣言する。コンポーネントやページのモジュールの中で宣言しない。
- 画面の一時状態（選択、開閉、フィルタの入力、タブ、下書き）は Effect Atom が持つ。Atom にサーバーの応答やその複製を載せない。
- 両方に跨る画面では、Atom はサーバー状態を選ぶ材料（id、フィルタ、ページ）だけを持ち、Query のキーはその材料から導く。表示用の派生値はレンダー中に計算し、Atom にも Query にも書き戻さない。
- サーバーへの書き込みは `@repo/ui` の `useAction` に載せ、成功後は該当する Query を無効化して反映する。UI 側で応答を手で書き込んで整合させない。楽観更新は `useOptimistic`。
- フォームの値は TanStack Form。Atom でも Query でも持たない。
- 同じサーバー状態を複数の場所で使うときは、同じ `queryOptions` を共有する。画面ごとに別の取得を書いて別々にキャッシュさせない。
