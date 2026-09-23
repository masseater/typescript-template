# CI の効率

検証は実行する場所ごとに責務を分ける。段階の定義は各 workspace の `vite.config.ts` の `lifecycle`（`precommit`・`prepush`・`prepr`・`premerge`・`prerelease`）と `.github/workflows/check.yml` が持つ。

- precommit: 毎回実行しても負担にならない静的解析。重いテストやビルドを載せない。
- prepush: 変更とその影響を受けるテスト・typecheck・build。影響範囲は task graph と依存関係から求め、全体を毎回実行しない。
- prepr: PR の変更・影響範囲に対する lint・typecheck・test・build。`.github/workflows` の `paths` / `paths-ignore` で制御せず、task graph から影響範囲を求める。全体の重い統合テストを PR ごとに実行しない。
- premerge: 統合後でなければ検証できないもの（integration、E2E、全体回帰）。必須チェックとして扱える構成にする。
- 各段階で同じ検証を重ねてよい。CI 上で独立して品質を保証できる構成にする。
- task cache・dependency cache・remote cache で不要な処理を繰り返さない。独立した task は並列実行する。
- 高速化のために検証対象を削らない。同じコミットの品質判定が、作業コピーや実行ホストの状態で変わらないようにする。
- 改善するときは、実行時間と実行量を計測してボトルネックを特定してから手を入れ、改善後に再計測する。ボトルネックでない処理を推測で最適化しない。
