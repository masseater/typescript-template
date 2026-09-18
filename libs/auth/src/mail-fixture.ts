import { setupNetwork } from "@msw/cloudflare";
import { Effect, Layer, Schema } from "effect";
import { HttpResponse, http } from "msw";

import { mailpitOrigin } from "@repo/config";

const HTTP_BAD_REQUEST = 400;
const mailConfig = { EMAIL_FROM: "no-reply@example.test", MAILPIT_URL: mailpitOrigin };
const MailpitMessage = Schema.Struct({
  From: Schema.Struct({ Email: Schema.String }),
  Subject: Schema.String,
  Text: Schema.String,
  To: Schema.Array(Schema.Struct({ Email: Schema.String })),
});
const decodeMail = Schema.decodeUnknownPromise(MailpitMessage);
const mailbox = new Map<string, string>();

async function receiveMail({ request }: { readonly request: Request }): Promise<Response> {
  const message = await decodeMail(await request.json());
  const url = message.Text.split("\n").find((line) => line.startsWith("http://"));
  if (
    message.From.Email !== mailConfig.EMAIL_FROM ||
    message.Subject !== "メールアドレスの確認" ||
    url === undefined
  ) {
    return HttpResponse.json({ error: "INVALID_EMAIL" }, { status: HTTP_BAD_REQUEST });
  }
  for (const recipient of message.To) {
    mailbox.set(recipient.Email, url);
  }
  return HttpResponse.json({ ID: crypto.randomUUID() });
}

const mailServer = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      mailbox.clear();
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(http.post(`${mailConfig.MAILPIT_URL}/api/v1/send`, receiveMail));
      network.enable();
      return network;
    }),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  ),
);

export { mailConfig, mailServer, mailbox };
