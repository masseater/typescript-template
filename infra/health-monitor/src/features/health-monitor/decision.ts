import type { ProbeResult } from "./probe.ts";

type HealthState = Readonly<Record<string, boolean>>;

const decideHealthAlerts = (
  healthProbes: readonly ProbeResult[],
  priorState: HealthState,
): {
  readonly notifications: ProbeResult[];
  readonly state: Record<string, boolean>;
} => {
  const notifications = healthProbes.filter(
    (healthProbe) => (priorState[healthProbe.service] ?? true) !== healthProbe.healthy,
  );
  const healthState = Object.fromEntries(
    healthProbes.map((healthProbe) => [healthProbe.service, healthProbe.healthy]),
  );
  return { notifications, state: healthState };
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
