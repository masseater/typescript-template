import type { ProbeResult } from "./probe.ts";

type HealthState = Readonly<Record<string, boolean>>;

const decideHealthAlerts = (
  probeResults: readonly ProbeResult[],
  priorState: HealthState,
): {
  readonly notifications: ProbeResult[];
  readonly state: Record<string, boolean>;
} => {
  const notifications = probeResults.filter(
    (probeResult) => (priorState[probeResult.service] ?? true) !== probeResult.healthy,
  );
  const nextState = Object.fromEntries(
    probeResults.map((probeResult) => [probeResult.service, probeResult.healthy]),
  );
  return { notifications, state: nextState };
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
