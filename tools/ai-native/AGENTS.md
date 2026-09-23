# @repo/ai-native

- 同一ホスト上の重いコマンドの同時実行数と、呼び出し元に返す出力の量を有限に保つ CLI。`throttle`、`spool`、`unabridged`、`sync-base`。
- 技術スタック: OpenTelemetry API 1, Effect 4。
- npm へは `private` を付けず `publishConfig.access: public` で出す。
- MUST: `throttle` を入れ子にしない。スロットはローカルファイルシステムに置く。
- MUST: 対話が要るコマンドを `spool` で包まない。
