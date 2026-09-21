import { sendNotificationEmail } from "@repo/auth";
import { NOTIFICATION_KIND, query, schema } from "@repo/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Effect } from "effect";

import { NotificationNotFound } from "./notification-not-found.ts";
import { OpsMail } from "./ops-mail.ts";

import type { NotificationKind } from "@repo/db";

const { notification, notificationPreference, user } = schema;

type NotifyPayload = Readonly<{
  readonly actorId?: string | undefined;
  readonly actorName?: string | undefined;
  readonly kind: NotificationKind;
  readonly recipientId: string;
  readonly subjectId: string;
  readonly title?: string | undefined;
}>;

type NotificationItem = Readonly<{
  createdAt: number;
  href: string;
  id: string;
  kind: NotificationKind;
  label: string;
  read: boolean;
}>;

type NotificationPreferences = Readonly<{
  boardMail: boolean;
  messageMail: boolean;
}>;

type NavBadges = Readonly<{
  notifications: number;
}>;

function presentation(
  row: Readonly<{
    actorName: string | null;
    kind: NotificationKind;
    subjectId: string;
    title: string | null;
  }>,
): Readonly<{ href: string; label: string }> {
  const actor = row.actorName ?? "利用者";
  switch (row.kind) {
    case NOTIFICATION_KIND.conversationMessage:
      return { href: `/messages/${row.subjectId}`, label: `${actor}さんからメッセージ` };
    case NOTIFICATION_KIND.follow:
      return { href: `/users/${row.subjectId}`, label: `${actor}さんにフォローされました` };
    case NOTIFICATION_KIND.boardPost:
      return {
        href: `/board/${row.subjectId}`,
        label: `${actor}さんが掲示板に投稿しました`,
      };
    case NOTIFICATION_KIND.inquiryReply:
      return { href: `/support/${row.subjectId}`, label: "お問い合わせに返信がありました" };
  }
}

const deliverNotificationEmail = Effect.fn("deliverNotificationEmail")(function* deliver(
  payload: NotifyPayload,
) {
  if (
    payload.kind !== NOTIFICATION_KIND.conversationMessage &&
    payload.kind !== NOTIFICATION_KIND.boardPost
  ) {
    return;
  }
  const mailKey =
    payload.kind === NOTIFICATION_KIND.conversationMessage ? "messageMail" : ("boardMail" as const);
  const [recipient] = yield* query((database) =>
    database
      .select({
        boardMail: notificationPreference.boardMail,
        email: user.email,
        messageMail: notificationPreference.messageMail,
      })
      .from(user)
      .leftJoin(notificationPreference, eq(notificationPreference.memberId, user.id))
      .where(eq(user.id, payload.recipientId))
      .limit(1),
  );
  if (recipient === undefined) {
    return;
  }
  const enabled =
    mailKey === "messageMail" ? (recipient.messageMail ?? false) : (recipient.boardMail ?? false);
  if (!enabled) {
    return;
  }
  const { href } = presentation({
    actorName: payload.actorName ?? null,
    kind: payload.kind,
    subjectId: payload.subjectId,
    title: payload.title ?? null,
  });
  const mail = yield* OpsMail;
  yield* sendNotificationEmail(mail, { href, kind: payload.kind, to: recipient.email });
});

const notify = Effect.fn("notify")(function* notify(payload: NotifyPayload) {
  const now = new Date();
  const id = crypto.randomUUID();
  yield* query((database) =>
    database.insert(notification).values({
      actorId: payload.actorId,
      actorName: payload.actorName,
      createdAt: now,
      id,
      kind: payload.kind,
      memberId: payload.recipientId,
      subjectId: payload.subjectId,
      title: payload.title,
    }),
  );
  yield* deliverNotificationEmail(payload);
  return id;
});

const listNotifications = Effect.fn("listNotifications")(function* listNotifications(
  memberId: string,
) {
  const rows = yield* query((database) =>
    database
      .select({
        actorName: notification.actorName,
        createdAt: notification.createdAt,
        id: notification.id,
        kind: notification.kind,
        readAt: notification.readAt,
        subjectId: notification.subjectId,
        title: notification.title,
      })
      .from(notification)
      .where(eq(notification.memberId, memberId))
      .orderBy(desc(notification.createdAt), notification.id)
      .limit(100),
  );
  return rows.map((row): NotificationItem => {
    const shown = presentation({
      actorName: row.actorName,
      kind: row.kind,
      subjectId: row.subjectId,
      title: row.title,
    });
    return {
      createdAt: row.createdAt.getTime(),
      href: shown.href,
      id: row.id,
      kind: row.kind,
      label: shown.label,
      read: row.readAt !== null,
    };
  });
});

const unreadNotificationCount = Effect.fn("unreadNotificationCount")(function* unread(
  memberId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select({ count: count() })
      .from(notification)
      .where(and(eq(notification.memberId, memberId), isNull(notification.readAt))),
  );
  return row?.count ?? 0;
});

const navBadges = Effect.fn("navBadges")(function* badges(memberId: string) {
  return { notifications: yield* unreadNotificationCount(memberId) } satisfies NavBadges;
});

const markNotificationRead = Effect.fn("markNotificationRead")(function* markRead(
  memberId: string,
  notificationId: string,
) {
  const [updated] = yield* query((database) =>
    database
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.id, notificationId),
          eq(notification.memberId, memberId),
          isNull(notification.readAt),
        ),
      )
      .returning({ id: notification.id }),
  );
  if (updated === undefined) {
    const [existing] = yield* query((database) =>
      database
        .select({ id: notification.id })
        .from(notification)
        .where(and(eq(notification.id, notificationId), eq(notification.memberId, memberId)))
        .limit(1),
    );
    if (existing === undefined) {
      return yield* new NotificationNotFound();
    }
  }
});

const markAllNotificationsRead = Effect.fn("markAllNotificationsRead")(function* markAll(
  memberId: string,
) {
  yield* query((database) =>
    database
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.memberId, memberId), isNull(notification.readAt))),
  );
});

const getNotificationPreferences = Effect.fn("getNotificationPreferences")(function* getPrefs(
  memberId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select({
        boardMail: notificationPreference.boardMail,
        messageMail: notificationPreference.messageMail,
      })
      .from(notificationPreference)
      .where(eq(notificationPreference.memberId, memberId))
      .limit(1),
  );
  return {
    boardMail: row?.boardMail ?? false,
    messageMail: row?.messageMail ?? false,
  } satisfies NotificationPreferences;
});

const updateNotificationPreferences = Effect.fn("updateNotificationPreferences")(function* update(
  memberId: string,
  preferences: NotificationPreferences,
) {
  const now = new Date();
  yield* query((database) =>
    database
      .insert(notificationPreference)
      .values({
        boardMail: preferences.boardMail,
        memberId,
        messageMail: preferences.messageMail,
      })
      .onConflictDoUpdate({
        set: { boardMail: preferences.boardMail, messageMail: preferences.messageMail },
        target: notificationPreference.memberId,
      }),
  );
  return preferences;
});

export {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  navBadges,
  notify,
  unreadNotificationCount,
  updateNotificationPreferences,
};
