import { setupNetwork } from "@msw/cloudflare";
import { mailpitOrigin, mailpitSendPath } from "@repo/config";
import { httpStatus } from "@repo/observability";
import { Context, Effect, Layer, Ref, Schema } from "effect";
import { HttpResponse, http } from "msw";

import { mailSubjects } from "./email.ts";

type Delivery = {
  readonly link: string;
  readonly recipient: string;
  readonly subject: string;
};

const mailConfig = {
  EMAIL_FROM: "no-reply@example.test",
  MAILPIT_SEND_URL: `${mailpitOrigin}${mailpitSendPath}`,
};
const knownSubjects = new Set<string>(Object.values(mailSubjects));
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
      !knownSubjects.has(mailpitMessage.Subject) ||
      link === undefined
    ) {
      return HttpResponse.json({ error: "INVALID_EMAIL" }, { status: httpStatus.badRequest });
    }
    const delivered = mailpitMessage.To.map(({ Email }) => ({
      link,
      recipient: Email,
      subject: mailpitMessage.Subject,
    }));
    await Effect.runPromise(Ref.update(deliveries, (earlier) => [...earlier, ...delivered]));
    return HttpResponse.json({ ID: crypto.randomUUID() });
  };
};

type Network = ReturnType<typeof setupNetwork>;

class MockNetwork extends Context.Service<MockNetwork, Network>()("@repo/auth/MockNetwork") {}

const startNetwork = (): Network => {
  const network = setupNetwork();
  network.configure({ onUnhandledFrame: "error" });
  network.enable();
  return network;
};

const stopNetwork = (network: Readonly<Network>): Effect.Effect<void> => {
  return Effect.sync(() => {
    network.disable();
  });
};

const mockNetwork = Layer.effect(
  MockNetwork,
  Effect.acquireRelease(Effect.sync(startNetwork), stopNetwork),
);

const mailServer = Layer.effect(
  Mailbox,
  Effect.gen(function* startMailServer() {
    const deliveries = yield* Ref.make<readonly Delivery[]>([]);
    (yield* MockNetwork).use(http.post(mailConfig.MAILPIT_SEND_URL, receiveMail(deliveries)));
    return deliveries;
  }),
).pipe(Layer.provideMerge(mockNetwork));

const mailRecipients = Effect.gen(function* readRecipients() {
  const deliveries = yield* Ref.get(yield* Mailbox);
  return deliveries.map(({ recipient }) => recipient);
});

const clearMailbox = Effect.gen(function* clearDeliveries() {
  yield* Ref.set(yield* Mailbox, []);
});

const receivedLink = Effect.fn("receivedLink")(function* receivedLink(
  email: string,
  subject: string,
) {
  const deliveries = yield* Ref.get(yield* Mailbox);
  const matched = deliveries.findLast(
    (delivery) => delivery.recipient === email && delivery.subject === subject,
  );
  return new URL(matched?.link ?? "");
});

const verificationLink = Effect.fn("verificationLink")(function* verificationLink(email: string) {
  return yield* receivedLink(email, mailSubjects.verification);
});

const hasMail = Effect.fn("hasMail")(function* hasMail(email: string) {
  const deliveries = yield* Ref.get(yield* Mailbox);
  return deliveries.some((delivery) => delivery.recipient === email);
});

export {
  Mailbox,
  MockNetwork,
  clearMailbox,
  hasMail,
  mailConfig,
  mailRecipients,
  mailServer,
  receivedLink,
  verificationLink,
};
