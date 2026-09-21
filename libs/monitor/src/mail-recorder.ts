import { WorkerEntrypoint } from "cloudflare:workers";

interface SentMail {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
}

class MailRecorder extends WorkerEntrypoint {
  static readonly #mailbox: SentMail[] = [];

  public send(message: SentMail): void {
    (this.constructor as typeof MailRecorder).#mailbox.push(message);
  }

  public taken(): SentMail[] {
    return (this.constructor as typeof MailRecorder).#mailbox.splice(0);
  }
}

export { MailRecorder };
export type { SentMail };
