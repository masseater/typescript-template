import { WorkerEntrypoint } from "cloudflare:workers";

interface SentMail {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
}

class MailRecorder extends WorkerEntrypoint {
  readonly #sent: SentMail[] = [];

  public send(message: SentMail): void {
    this.#sent.push(message);
  }

  public taken(): SentMail[] {
    return this.#sent.splice(0);
  }
}

export { MailRecorder };
export type { SentMail };
