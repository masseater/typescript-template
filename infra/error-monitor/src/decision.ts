import type { ErrorGroup } from "./telemetry.ts";

type SeenFingerprints = Readonly<Record<string, number>>;
interface Notification extends ErrorGroup {
  readonly reason: "new" | "regressed";
}
interface NotificationDecision {
  readonly notifications: Notification[];
  readonly seen: Record<string, number>;
}

const MILLISECONDS_PER_DAY = 86_400_000;
const FORGET_AFTER_DAYS = 7;
const quietPeriod = MILLISECONDS_PER_DAY;
const forgetAfter = FORGET_AFTER_DAYS * MILLISECONDS_PER_DAY;

function decideNotifications(
  groups: readonly ErrorGroup[],
  seen: SeenFingerprints,
  now: number,
): NotificationDecision {
  const notifications = groups.flatMap((group): Notification[] => {
    const lastSeen = seen[group.fingerprint];
    if (lastSeen === undefined) {
      return [{ ...group, reason: "new" }];
    }
    if (now - lastSeen >= quietPeriod) {
      return [{ ...group, reason: "regressed" }];
    }
    return [];
  });
  const next = Object.fromEntries([
    ...Object.entries(seen).filter(
      ([, lastSeen]: readonly [string, number]) => now - lastSeen < forgetAfter,
    ),
    ...groups.map((group) => [group.fingerprint, now] as const),
  ]);
  return { notifications, seen: next };
}

const MISSING_VALUE = "(値なし)";

function reported(value: string | undefined): string {
  return value ?? MISSING_VALUE;
}

function formatMessage(notifications: readonly Notification[]): string {
  return [
    `Cloudflare Workers で ${notifications.length} 件のエラーを検出しました。`,
    ...notifications.map(
      (item) =>
        `- [${item.reason === "new" ? "新規" : "再発"}] ${reported(item.service)} ${reported(item.event)} ${reported(item.type)} (fingerprint ${item.fingerprint}, ${item.count} 件)`,
    ),
    "Workers Observability で error.fingerprint を指定して検索してください。",
  ].join("\n");
}

export { decideNotifications, formatMessage };
export type { SeenFingerprints };
