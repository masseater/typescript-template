import type { ProbeResult } from "./probe.ts";

type HealthState = Readonly<Record<string, boolean>>;

type HealthDecision = {
  readonly notifications: ProbeResult[];
  readonly state: Record<string, boolean>;
};

const decideHealthAlerts = (
  results: readonly ProbeResult[],
  previous: HealthState,
): HealthDecision => {
  const notifications = results.filter(
    (result) => (previous[result.service] ?? true) !== result.healthy,
  );
  const state = Object.fromEntries(results.map((result) => [result.service, result.healthy]));
  return { notifications, state };
};

const formatHealthMessage = (notifications: readonly ProbeResult[]): string => {
  return [
    ...notifications.map(
      (item) => `- [${item.healthy ? "復旧" : "停止"}] ${item.service} (${item.detail})`,
    ),
    "Workers Observability で health_monitor.checked のログを確認してください。",
  ].join("\n");
};

export { decideHealthAlerts, formatHealthMessage };
export type { HealthState };
