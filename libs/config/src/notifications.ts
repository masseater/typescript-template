/** @canonical-values db.notification-kind */
export const notificationKinds = [
  "conversation_message",
  "follow",
  "board_post",
  "inquiry_reply",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export const NOTIFICATION_KIND = {
  boardPost: notificationKinds[2],
  conversationMessage: notificationKinds[0],
  follow: notificationKinds[1],
  inquiryReply: notificationKinds[3],
} as const;
