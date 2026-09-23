# AGENTS.md

- 社内 wiki の Worker。リポジトリの文書を `/wiki` 以下で描画・検索し、MCP 向けの文書を Effect RPC で返す。
- 公開ルートを持たず、認証を済ませた Service Binding からだけ到達する。
- 技術スタック: TanStack Start 1, React 19, fumadocs 16, Effect 4, Tailwind CSS 4。
- MUST: 独自ドメイン・route・workers.dev を付けない。
