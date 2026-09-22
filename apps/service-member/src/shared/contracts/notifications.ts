import { notificationKinds } from "@repo/config";
import { Schema } from "effect";

const NotificationKind = Schema.Literals(notificationKinds);

const NotificationItem = Schema.Struct({
  createdAt: Schema.Finite,
  href: Schema.String,
  id: Schema.String,
  kind: NotificationKind,
  label: Schema.String,
  read: Schema.Boolean,
});

const NotificationList = Schema.Struct({
  items: Schema.Array(NotificationItem),
});

const NotificationUnread = Schema.Struct({
  count: Schema.Finite,
});

const NavBadges = Schema.Struct({
  notifications: Schema.Finite,
});

const NotificationId = Schema.Struct({
  id: Schema.String.check(Schema.isLengthBetween(1, 256)),
});

const NotificationPreferences = Schema.Struct({
  boardMail: Schema.Boolean,
  messageMail: Schema.Boolean,
});

export {
  NavBadges,
  NotificationId,
  NotificationItem,
  NotificationList,
  NotificationPreferences,
  NotificationUnread,
};
