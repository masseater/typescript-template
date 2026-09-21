# 一部だけ依存するときは、依存しない側を先に走らせる

`user` が終わってから `profile` を取る必要があるときでも、`config` は `user` を待たせない。

`better-all` は入れない。`.then` も使わない。依存しない Effect と、依存する Effect を `Effect.flatMap` で組んだものを、一つの `Effect.all(..., { concurrency: "unbounded" })` に入れる。

```ts
const loaded = Effect.all(
  {
    config: fetchConfig,
    profile: fetchUser.pipe(Effect.flatMap((user) => fetchProfile(user.id))),
  },
  { concurrency: "unbounded" },
);
```
