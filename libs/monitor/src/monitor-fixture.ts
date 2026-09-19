import { Effect } from "effect";

import { MonitorFailure } from "./failure.ts";
import { monitorWorker } from "./index.ts";

import type { MonitorBindings } from "./index.ts";
import type { SentMail } from "./mail-recorder.ts";

type Outcome = "die" | "fail" | "notify" | "succeed";

declare global {
  // oxlint-disable-next-line typescript/no-namespace
  namespace Cloudflare {
    interface Env {
      readonly ALERT_FROM: string;
      readonly ALERT_TO: string;
      readonly EMAIL: { readonly taken: () => Promise<SentMail[]> };
      readonly MONITOR: DurableObjectNamespace;
    }
  }
}

const probeEvent = "probe_monitor";
const probeAlert = { subject: "probe alert", text: "probe alert" } as const;
const probeFailure = { subject: "probe failed", text: "probe failed" } as const;

const probeMonitor = monitorWorker<MonitorBindings>({
  check({ ctx }, notify) {
    return Effect.gen(function* probe() {
      const outcome = yield* Effect.promise(async () => ctx.storage.get<Outcome>("outcome"));
      if (outcome === "fail") {
        return yield* new MonitorFailure({ code: "alert_config_invalid" });
      }
      if (outcome === "die") {
        return yield* Effect.die("the probe was asked to defect");
      }
      if (outcome === "notify") {
        yield* notify(probeAlert);
      }
      return { outcome: outcome ?? "succeed" };
    });
  },
  className: "ProbeMonitor",
  event: probeEvent,
  failure: probeFailure,
});

const ProbeMonitor = probeMonitor.Worker;

export { MailRecorder } from "./mail-recorder.ts";
export type { SentMail } from "./mail-recorder.ts";
export { ProbeMonitor, probeAlert, probeEvent, probeFailure };
export type { Outcome };
export default probeMonitor.handler;
