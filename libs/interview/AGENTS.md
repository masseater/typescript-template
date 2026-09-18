# AGENTS.md

- 面談セッションの進行エンジンと、その公開契約を提供する。Workers AI のモデルで回答を解釈する。
- 技術スタック: TanStack AI 0.54, Cloudflare Workers AI, Effect 4。
- MUST: モデルと生成条件は `src/interviewer.ts` の一箇所で決める。呼び出し側からモデルを差し替えない。
