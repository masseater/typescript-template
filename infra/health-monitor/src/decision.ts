import type { ProbeResult } from "./probe.ts";

export type HealthState = Readonly<Record<string, boolean>>;

export function decideHealthAlerts(results: readonly ProbeResult[], previous: HealthState) {
  const notifications = results.filter(
    (result) => (previous[result.service] ?? true) !== result.healthy,
  );
  const state = Object.fromEntries(results.map((result) => [result.service, result.healthy]));
  return { notifications, state };
}

export function formatHealthMessage(notifications: readonly ProbeResult[]) {
  return [
    ...notifications.map(
      (item) => `- [${item.healthy ? "復旧" : "停止"}] ${item.service} (${item.detail})`,
    ),
    "Workers Observability で health_monitor.checked のログを確認してください。",
  ].join("\n");
}
