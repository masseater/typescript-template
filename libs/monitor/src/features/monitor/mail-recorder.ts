import { WorkerEntrypoint } from "cloudflare:workers";

type SentMail = {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
};

class MailRecorder extends WorkerEntrypoint {
  static readonly #mailbox: SentMail[] = [];

  public send(sentMail: SentMail): void {
    (this.constructor as typeof MailRecorder).#mailbox.push(sentMail);
  }

  public taken(): readonly SentMail[] {
    return (this.constructor as typeof MailRecorder).#mailbox.splice(0);
  }
}

export { MailRecorder };
export type { SentMail };
