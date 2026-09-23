import { Effect, Ref } from "effect";

import type { Metric } from "web-vitals";
type VitalMetric = Readonly<Pick<Metric, "name" | "value">>;
const stoppableVitals = (
  enqueueVital: (metric: VitalMetric) => void,
): {
  readonly report: (metric: VitalMetric) => void;
  readonly stop: () => void;
} => {
  const stopped = Ref.makeUnsafe(false);
  return {
    report: (metric) => {
      if (Ref.getUnsafe(stopped)) {
        return;
      }
      enqueueVital(metric);
    },
    stop: () => {
      Effect.runSync(Ref.set(stopped, true));
    },
  };
};
export { stoppableVitals };
export type { VitalMetric };
