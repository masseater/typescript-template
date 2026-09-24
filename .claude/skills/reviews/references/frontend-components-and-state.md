# フロントエンドのコンポーネントと状態

## コンポーネントと仕様の置き場所

- UI コンポーネントは `libs/ui` の基盤（`libs/ui/package.json` にある React、shadcn、Tailwind CSS）の上に作る。
- アプリ固有の画面の組み立ては、各アプリの FSD 境界の内側に置く。共通にできる見た目だけを `libs/ui` へ切り出す。
- 外部の UI キットのデモやブロック集を、依存や規則の根拠にしない。
- 画面の構成と遷移の判断は `apps/internal-dashboard/content/docs/pages/` に置く。references に混ぜない。

## サーバー状態と UI 状態

- サーバーにある事実（一覧、詳細、権限、集計）は TanStack Query の `useQuery` で取得してキャッシュする。`fetch` の結果やレスポンスを Effect Atom や `useState` にコピーしない。
- `queryOptions`、`infiniteQueryOptions`、`mutationOptions` は FSD の `api` セグメントで宣言する。コンポーネントやページのモジュールの中で宣言しない。
- 画面の一時的な状態（選択、開閉、フィルタの入力、タブ、下書き）は Effect Atom に置く。Atom にサーバーのレスポンスやそのコピーを載せない。
- 両方にまたがる画面では、Atom にはサーバー状態を選ぶための材料（id、フィルタ、ページ）だけを持たせ、Query のキーはその材料から導く。表示用の派生値はレンダー中に計算し、Atom にも Query にも書き戻さない。
- サーバーへの書き込みは `@repo/ui` の `useAction` に載せ、成功したら該当する Query を無効化して反映する。UI 側でレスポンスを手で書き込んで整合させない。楽観更新は `useOptimistic` を使う。
- フォームの値は TanStack Form に持たせる。Atom にも Query にも持たせない。
- 同じサーバー状態を複数の場所で使うときは、同じ `queryOptions` を共有する。画面ごとに別の取得を書いて別々にキャッシュさせない。
