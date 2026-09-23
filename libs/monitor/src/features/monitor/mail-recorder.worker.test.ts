import { env } from "cloudflare:workers";
import { describe, expect, test } from "vite-plus/test";

const sentMail = {
  from: "monitor@example.test",
  subject: "recorded delivery",
  text: "the body that was sent",
  to: ["operator@example.test"],
} as const;

describe("MailRecorder", () => {
  describe("a message handed to send", () => {
    const it = test.extend("delivered", () => {
      env.EMAIL.taken();
      env.EMAIL.send(sentMail);
      return env.EMAIL.taken();
    });

    it("returns that message from taken", ({ delivered }) => {
      expect(delivered).toStrictEqual([sentMail]);
    });
  });

  describe("a mailbox that was already drained", () => {
    const it = test.extend("drained", () => {
      env.EMAIL.taken();
      env.EMAIL.send(sentMail);
      env.EMAIL.taken();
      return env.EMAIL.taken();
    });

    it("returns nothing", ({ drained }) => {
      expect(drained).toStrictEqual([]);
    });
  });
});
