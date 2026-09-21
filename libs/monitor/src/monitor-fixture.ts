import { Effect } from "effect";

import { MonitorFailure } from "./failure.ts";
import { monitorWorker, type MonitorBindings } from "./index.ts";
import { type SentMail } from "./mail-recorder.ts";

import type { DurableObjectNamespace } from "@cloudflare/workers-types";

/** @canonical-values monitor.probe-outcome */
const probeOutcomes = ["die", "fail", "notify", "succeed"] as const;

type Outcome = (typeof probeOutcomes)[number];

declare global {
  namespace Cloudflare {
    interface Env {
      readonly ALERT_FROM: string;
      readonly ALERT_TO: string;
      readonly EMAIL: {
        readonly send: (sentMail: SentMail) => void;
        readonly taken: () => readonly SentMail[];
      };
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
      const recordedProbe = yield* Effect.promise(async () => ctx.storage.get<Outcome>("outcome"));
      if (recordedProbe === "fail") {
        return yield* new MonitorFailure({ code: "alert_config_invalid" });
      }
      if (recordedProbe === "die") {
        return yield* Effect.die("the probe was asked to defect");
      }
      if (recordedProbe === "notify") {
        yield* notify(probeAlert);
      }
      return { outcome: recordedProbe ?? "succeed" };
    });
  },
  event: probeEvent,
  failure: probeFailure,
});

export { MailRecorder } from "./mail-recorder.ts";
export type { SentMail } from "./mail-recorder.ts";

class ProbeMonitor extends probeMonitor.Worker {}

export { ProbeMonitor, probeAlert, probeEvent, probeFailure };
export type { Outcome };
export default probeMonitor.handler;
