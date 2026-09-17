import type { ErrorGroup } from "./telemetry.ts";

export type SeenFingerprints = Readonly<Record<string, number>>;
type Notification = ErrorGroup & { reason: "new" | "regressed" };

const quietPeriod = 24 * 60 * 60 * 1000;
const forgetAfter = 7 * 24 * 60 * 60 * 1000;

export function decideNotifications(
  groups: readonly ErrorGroup[],
  seen: SeenFingerprints,
  now: number,
) {
  const notifications = groups.flatMap((group): Notification[] => {
    const lastSeen = seen[group.fingerprint];
    if (lastSeen === undefined) return [{ ...group, reason: "new" }];
    if (now - lastSeen >= quietPeriod) return [{ ...group, reason: "regressed" }];
    return [];
  });
  const next = Object.fromEntries([
    ...Object.entries(seen).filter(([, lastSeen]) => now - lastSeen < forgetAfter),
    ...groups.map((group) => [group.fingerprint, now] as const),
  ]);
  return { notifications, seen: next };
}

export function formatMessage(notifications: readonly Notification[]) {
  return [
    `Cloudflare Workers で ${notifications.length} 件のエラーを検出しました。`,
    ...notifications.map(
      (item) =>
        `- [${item.reason === "new" ? "新規" : "再発"}] ${item.service} ${item.event} ${item.type} (fingerprint ${item.fingerprint}, ${item.count} 件)`,
    ),
    "Workers Observability で error.fingerprint を指定して検索してください。",
  ].join("\n");
}
