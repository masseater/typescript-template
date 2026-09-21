import type { ProbeResult } from "./probe.ts";

type HealthState = Readonly<Record<string, boolean>>;

const decideHealthAlerts = (
  checkedHealths: readonly ProbeResult[],
  previousHealth: HealthState,
): {
  readonly notifications: ProbeResult[];
  readonly healthByService: Record<string, boolean>;
} => {
  const notifications = checkedHealths.filter(
    (checkedHealth) =>
      (previousHealth[checkedHealth.service] ?? true) !== checkedHealth.healthy,
  );
  const healthByService = Object.fromEntries(
    checkedHealths.map((checkedHealth) => [checkedHealth.service, checkedHealth.healthy]),
  );
  return { healthByService, notifications };
};

const formatHealthMessage = (notifications: readonly ProbeResult[]): string =>
  [
    ...notifications.map(
      (notification) =>
        `- [${notification.healthy ? "復旧" : "停止"}] ${notification.service} (${notification.detail})`,
    ),
    "Workers Observability で health_monitor.checked のログを確認してください。",
  ].join("\n");

export { decideHealthAlerts, formatHealthMessage };
export type { HealthState };
