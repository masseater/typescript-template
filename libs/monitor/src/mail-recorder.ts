import { WorkerEntrypoint } from "cloudflare:workers";

type SentMail = {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
};

const sent: SentMail[] = [];

class MailRecorder extends WorkerEntrypoint {
  public send(message: SentMail): void {
    sent.push(message);
  }

  public taken(): SentMail[] {
    return sent.splice(0);
  }
}

export { MailRecorder };
export type { SentMail };
