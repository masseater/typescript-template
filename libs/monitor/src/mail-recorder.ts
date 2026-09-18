import { WorkerEntrypoint } from "cloudflare:workers";

export type SentMail = {
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly to: readonly string[];
};

export class MailRecorder extends WorkerEntrypoint<{ readonly SENT_MAIL: KVNamespace }> {
  public async send(sentMail: SentMail): Promise<void> {
    await this.env.SENT_MAIL.put(`${Date.now()}-${crypto.randomUUID()}`, JSON.stringify(sentMail));
  }
}
