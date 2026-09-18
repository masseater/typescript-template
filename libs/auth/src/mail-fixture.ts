import { setupNetwork } from "@msw/cloudflare";
import { mailpitOrigin } from "@repo/config";
import { httpStatus } from "@repo/observability";
import { Context, Effect, Layer, Ref, Schema } from "effect";
import { HttpResponse, http } from "msw";

type Delivery = { readonly recipient: string; readonly link: string };

const mailConfig = {
  EMAIL_FROM: "no-reply@example.test",
  MAILPIT_SEND_URL: `${mailpitOrigin}/api/v1/send`,
};
const MailpitMessage = Schema.Struct({
  From: Schema.Struct({ Email: Schema.String }),
  Subject: Schema.String,
  Text: Schema.String,
  To: Schema.Array(Schema.Struct({ Email: Schema.String })),
});
const decodeMail = Schema.decodeUnknownPromise(MailpitMessage);

class Mailbox extends Context.Service<Mailbox, Ref.Ref<readonly Delivery[]>>()(
  "@repo/auth/Mailbox",
) {}

const receiveMail = (deliveries: Mailbox["Service"]) => {
  return async ({ request }: { readonly request: Request }): Promise<Response> => {
    const mailpitMessage = await decodeMail(await request.json());
    const link = mailpitMessage.Text.split("\n").find((line) => line.startsWith("http://"));
    if (
      mailpitMessage.From.Email !== mailConfig.EMAIL_FROM ||
      mailpitMessage.Subject !== "メールアドレスの確認" ||
      link === undefined
    ) {
      return HttpResponse.json({ error: "INVALID_EMAIL" }, { status: httpStatus.badRequest });
    }
    const delivered = mailpitMessage.To.map(({ Email }) => ({ link, recipient: Email }));
    await Effect.runPromise(Ref.update(deliveries, (earlier) => [...earlier, ...delivered]));
    return HttpResponse.json({ ID: crypto.randomUUID() });
  };
};

const startNetwork = (deliveries: Mailbox["Service"]): ReturnType<typeof setupNetwork> => {
  const network = setupNetwork();
  network.configure({ onUnhandledFrame: "error" });
  network.use(http.post(mailConfig.MAILPIT_SEND_URL, receiveMail(deliveries)));
  network.enable();
  return network;
};

const stopNetwork = (network: ReturnType<typeof setupNetwork>): Effect.Effect<void> => {
  return Effect.sync(() => {
    network.disable();
  });
};

const mailServer = Layer.effect(
  Mailbox,
  Effect.gen(function* startMailServer() {
    const deliveries = yield* Ref.make<readonly Delivery[]>([]);
    yield* Effect.acquireRelease(
      Effect.sync(() => startNetwork(deliveries)),
      stopNetwork,
    );
    return deliveries;
  }),
);

const mailRecipients = Effect.gen(function* readRecipients() {
  const deliveries = yield* Ref.get(yield* Mailbox);
  return deliveries.map(({ recipient }) => recipient);
});

const verificationLink = Effect.fn("verificationLink")(function* verificationLink(email: string) {
  const deliveries = yield* Ref.get(yield* Mailbox);
  return new URL(deliveries.findLast(({ recipient }) => recipient === email)?.link ?? "");
});

export { Mailbox, mailConfig, mailRecipients, mailServer, verificationLink };
