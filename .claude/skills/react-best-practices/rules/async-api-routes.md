# API では、依存しない処理を認証の後に始めない

セッションが要る読み取りと、セッションが要らない読み取りを、認証の `await` の後ろに並べない。

セッションが要らない Effect は、認証と同時に走らせる。セッションが要る Effect は、認証の結果を `Effect.flatMap` で受け取ってから始める。両方を `Effect.all(..., { concurrency: "unbounded" })` に載せる。

Elysia のルートも TanStack Start のサーバー関数も同じである。
