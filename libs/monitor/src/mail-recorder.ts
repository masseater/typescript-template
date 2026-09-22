import { WorkerEntrypoint } from "cloudflare:workers";

type SentMail = {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
};

class MailRecorder extends WorkerEntrypoint {
  #delivered: SentMail[] = [];

  public send(sentMail: SentMail): void {
    this.#delivered = [...this.#delivered, sentMail];
  }

  public taken(): readonly SentMail[] {
    const delivered = this.#delivered;
    this.#delivered = [];
    return delivered;
  }
}

export { MailRecorder };
export type { SentMail };
