import { Effect } from "effect";

import { MonitorFailure } from "./failure.ts";
import { Monitor, monitorHandler, type MonitorBindings, type Notify } from "./monitor.ts";

export { MailRecorder } from "./mail-recorder.ts";

export const probeEvent = "probe_monitor";
export const probeAlert = { subject: "probe alert", text: "probe alert" } as const;
export const probeFailure = { subject: "probe failed", text: "probe failed" } as const;

/** @canonical-values monitor.probe-behaviour */
export const probeBehaviours = ["fail", "notify", "succeed"] as const;

const [failingBehaviour, notifyingBehaviour, succeedingBehaviour] = probeBehaviours;

export const probeBehaviourKey = "behaviour";

export class ProbeMonitor extends Monitor<MonitorBindings> {
  protected readonly eventName = probeEvent;
  protected readonly failure = probeFailure;

  protected check(notify: Notify): Effect.Effect<object, MonitorFailure> {
    const { storage } = this.ctx;
    return Effect.gen(function* probe() {
      const seededBehaviour = yield* Effect.promise(async () =>
        storage.get<(typeof probeBehaviours)[number]>(probeBehaviourKey),
      );
      if (seededBehaviour === failingBehaviour) {
        return yield* new MonitorFailure({ code: "alert_config_invalid" });
      }
      if (seededBehaviour === notifyingBehaviour) {
        yield* notify(probeAlert);
      }
      return { behaviour: seededBehaviour ?? succeedingBehaviour };
    });
  }
}

declare global {
  namespace Cloudflare {
    interface Env {
      readonly ALERT_FROM: string;
      readonly ALERT_TO: string;
      readonly EMAIL: SendEmail;
      readonly MONITOR: DurableObjectNamespace<ProbeMonitor>;
      readonly SENT_MAIL: KVNamespace;
    }
  }
}

export default monitorHandler(probeEvent);
