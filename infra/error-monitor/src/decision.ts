import type { ErrorGroup } from "./telemetry.ts";

type SeenFingerprints = Readonly<Record<string, number>>;
type Notification = ErrorGroup & {
  readonly reason: "new" | "regressed";
};

const MILLISECONDS_PER_DAY = 86_400_000;
const FORGET_AFTER_DAYS = 7;
const quietPeriod = MILLISECONDS_PER_DAY;
const forgetAfter = FORGET_AFTER_DAYS * MILLISECONDS_PER_DAY;

const decideNotifications = (asked: {
  readonly errorGroups: readonly ErrorGroup[];
  readonly seenFingerprints: SeenFingerprints;
  readonly observedAtMs: number;
}): {
  readonly notifications: Notification[];
  readonly seen: Record<string, number>;
} => {
  const notifications = asked.errorGroups.flatMap((errorGroup): Notification[] => {
    const lastSeen = asked.seenFingerprints[errorGroup.fingerprint];
    if (lastSeen === undefined) {
      return [{ ...errorGroup, reason: "new" }];
    }
    if (asked.observedAtMs - lastSeen >= quietPeriod) {
      return [{ ...errorGroup, reason: "regressed" }];
    }
    return [];
  });
  const retainedSeen = Object.fromEntries([
    ...Object.entries(asked.seenFingerprints).filter(
      ([, lastSeen]: readonly [string, number]) => asked.observedAtMs - lastSeen < forgetAfter,
    ),
    ...asked.errorGroups.map(
      (errorGroup) => [errorGroup.fingerprint, asked.observedAtMs] as const,
    ),
  ]);
  return { notifications, seen: retainedSeen };
};

const MISSING_VALUE = "(値なし)";

const reported = (fieldValue: string | undefined): string => fieldValue ?? MISSING_VALUE;

const formatMessage = (notifications: readonly Notification[]): string =>
  [
    `Cloudflare Workers で ${notifications.length} 件のエラーを検出しました。`,
    ...notifications.map(
      (notification) =>
        `- [${notification.reason === "new" ? "新規" : "再発"}] ${reported(notification.service)} ${reported(notification.event)} ${reported(notification.tag)} ${reported(notification.type)} (fingerprint ${notification.fingerprint}, ${notification.count} 件)`,
    ),
    "Workers Observability で error.fingerprint を指定して検索してください。",
  ].join("\n");

export { decideNotifications, formatMessage };
export type { SeenFingerprints };
