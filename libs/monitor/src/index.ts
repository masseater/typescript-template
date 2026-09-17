import {
  array,
  email,
  maxLength,
  minLength,
  object,
  parse,
  pipe,
  string,
  transform,
} from "valibot";

interface Alert {
  readonly subject: string;
  readonly text: string;
}

type Notify = (alert: Alert) => Promise<void>;

interface MonitorBindings {
  readonly ALERT_FROM: string;
  readonly ALERT_TO: string;
  readonly EMAIL: SendEmail;
  readonly MONITOR: DurableObjectNamespace;
}

const MAX_ALERT_RECIPIENTS = 10;
const ISO_DATE_LENGTH = 10;
const NOT_FOUND_STATUS = 404;

const emailAddress = pipe(string(), email());
const alertEnvironment = {
  ALERT_FROM: emailAddress,
  ALERT_TO: pipe(
    string(),
    transform((value) => value.split(",")),
    array(emailAddress),
    minLength(1),
    maxLength(MAX_ALERT_RECIPIENTS),
  ),
};
const alertSchema = object(alertEnvironment);

abstract class Monitor<Bindings extends MonitorBindings> {
  protected abstract readonly event: string;
  protected abstract readonly failure: Alert;
  protected readonly ctx: DurableObjectState;
  protected readonly env: Bindings;

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  public constructor(ctx: DurableObjectState, env: Bindings) {
    this.ctx = ctx;
    this.env = env;
  }

  public async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => this.run());
  }

  private async run(): Promise<Response> {
    const notify = this.notifier();
    const started = Date.now();
    try {
      const result = await this.check(notify);
      await this.ctx.storage.delete("failureNotifiedDay");
      // oxlint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: `${this.event}.checked`,
          ...result,
          durationMs: Date.now() - started,
        }),
      );
      return Response.json({ ok: true, ...result });
    } catch {
      await this.reportFailure(notify, started);
      throw new Error(`${this.event}_check_failed`);
    }
  }

  private notifier(): Notify {
    const recipients = parse(alertSchema, this.env);
    return async (alert) => {
      await this.env.EMAIL.send({ from: recipients.ALERT_FROM, to: recipients.ALERT_TO, ...alert });
    };
  }

  private async reportFailure(notify: Notify, started: number): Promise<void> {
    // oxlint-disable-next-line no-console
    console.error(
      JSON.stringify({ durationMs: Date.now() - started, event: `${this.event}.check_failed` }),
    );
    const day = new Date(started).toISOString().slice(0, ISO_DATE_LENGTH);
    if ((await this.ctx.storage.get<string>("failureNotifiedDay")) === day) {
      return;
    }
    await notify(this.failure);
    await this.ctx.storage.put("failureNotifiedDay", day);
  }

  protected abstract check(notify: Notify): Promise<object>;
}

interface MonitorHandler {
  readonly fetch: () => Response;
  readonly scheduled: (controller: unknown, env: MonitorSchedule) => Promise<void>;
}

type MonitorSchedule = Readonly<{
  MONITOR: Readonly<Pick<DurableObjectNamespace, "get" | "idFromName">>;
}>;

function monitorHandler(event: string): MonitorHandler {
  return {
    fetch: () => new Response("Not found", { status: NOT_FOUND_STATUS }),
    scheduled: async (_controller, env) => {
      const stub = env.MONITOR.get(env.MONITOR.idFromName(event));
      const result = await stub.fetch("https://monitor.internal/check", { method: "POST" });
      if (!result.ok) {
        throw new Error(`${event}_schedule_failed`);
      }
    },
  };
}

export { Monitor, alertEnvironment, monitorHandler };
export type { Alert, MonitorBindings, Notify };
