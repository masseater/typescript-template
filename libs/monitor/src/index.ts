import * as v from "valibot";

export const alertEnvironment = {
  ALERT_FROM: v.pipe(v.string(), v.email()),
  ALERT_TO: v.pipe(
    v.string(),
    v.transform((value) => value.split(",")),
    v.array(v.pipe(v.string(), v.email())),
    v.minLength(1),
    v.maxLength(10),
  ),
};

export interface MonitorBindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  ALERT_FROM: string;
  ALERT_TO: string;
}

type Alert = { subject: string; text: string };

export abstract class Monitor<Bindings extends MonitorBindings> {
  protected readonly ctx: DurableObjectState;
  protected readonly env: Bindings;

  constructor(ctx: DurableObjectState, env: Bindings) {
    this.ctx = ctx;
    this.env = env;
  }

  protected abstract readonly event: string;
  protected abstract readonly failure: Alert;
  protected abstract check(notify: (alert: Alert) => Promise<void>): Promise<object>;

  async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const recipients = v.parse(v.object(alertEnvironment), this.env);
      const notify = async (alert: Alert) => {
        await this.env.EMAIL.send({
          from: recipients.ALERT_FROM,
          to: recipients.ALERT_TO,
          ...alert,
        });
      };
      const started = Date.now();
      try {
        const result = await this.check(notify);
        await this.ctx.storage.delete("failureNotifiedDay");
        console.log(
          JSON.stringify({
            event: `${this.event}.checked`,
            ...result,
            durationMs: Date.now() - started,
          }),
        );
        return Response.json({ ok: true, ...result });
      } catch {
        console.error(
          JSON.stringify({ event: `${this.event}.check_failed`, durationMs: Date.now() - started }),
        );
        const day = new Date(started).toISOString().slice(0, 10);
        if ((await this.ctx.storage.get<string>("failureNotifiedDay")) !== day) {
          await notify(this.failure);
          await this.ctx.storage.put("failureNotifiedDay", day);
        }
        throw new Error(`${this.event}_check_failed`);
      }
    });
  }
}

export function monitorHandler(event: string) {
  return {
    fetch: () => new Response("Not found", { status: 404 }),
    async scheduled(_controller: ScheduledController, env: MonitorBindings) {
      const stub = env.MONITOR.get(env.MONITOR.idFromName(event));
      const result = await stub.fetch("https://monitor.internal/check", { method: "POST" });
      if (!result.ok) throw new Error(`${event}_schedule_failed`);
    },
  } satisfies ExportedHandler<MonitorBindings>;
}
