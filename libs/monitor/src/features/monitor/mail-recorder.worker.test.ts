import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

const message = {
  from: "monitor@example.test",
  subject: "recorded delivery",
  text: "the body that was sent",
  to: ["operator@example.test"],
} as const;

describe("MailRecorder", () => {
  describe("a message handed to send", () => {
    const it = test.extend("mailbox", () =>
      Effect.runPromise(
        Effect.gen(function* mailbox() {
          yield* Effect.promise(() => env.EMAIL.taken());
          yield* Effect.sync(() => {
            env.EMAIL.send(message);
          });
          const first = yield* Effect.promise(() => env.EMAIL.taken());
          const second = yield* Effect.promise(() => env.EMAIL.taken());
          return { first, second };
        }),
      ));

    it("returns that message from taken and then nothing", ({ mailbox }) => {
      expect(mailbox).toStrictEqual({ first: [message], second: [] });
    });
  });
});
