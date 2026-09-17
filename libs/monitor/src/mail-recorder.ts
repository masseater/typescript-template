import { WorkerEntrypoint } from "cloudflare:workers";

interface SentMail {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
}

const sent: SentMail[] = [];

class MailRecorder extends WorkerEntrypoint {
  // oxlint-disable-next-line eslint/class-methods-use-this
  public send(message: SentMail): void {
    sent.push(message);
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  public taken(): SentMail[] {
    return sent.splice(0);
  }
}

export { MailRecorder };
export type { SentMail };
