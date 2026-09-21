/** @canonical-values db.conversation-kind */
export const conversationKinds = ["direct", "group"] as const;
export type ConversationKind = (typeof conversationKinds)[number];
export const CONVERSATION_KIND = {
  direct: conversationKinds[0],
  group: conversationKinds[1],
} as const;
