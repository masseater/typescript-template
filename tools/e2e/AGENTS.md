# AGENTS.md

- 3 つのアプリを実ブラウザ・実 Worker・実ローカル D1 で通しに検査する E2E。導線は画面上の役割と URL だけで辿り、アプリのディレクトリ名や内部識別子には触れない。
- 技術スタック: Playwright 1, Vitest 4, Vite+ の dev サーバー, Effect 4。
