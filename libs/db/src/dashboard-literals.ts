/** @canonical-values db.audit-action */
export const auditActions = ["flag_toggled", "role_changed", "user_deleted"] as const;
export const AUDIT_ACTION = {
  flagToggled: auditActions[0],
  roleChanged: auditActions[1],
  userDeleted: auditActions[2],
} as const;

/** @canonical-values db.client-kind */
export const clientKinds = ["ai", "bot", "human", "total"] as const;
export const CLIENT_KIND = {
  ai: clientKinds[0],
  bot: clientKinds[1],
  human: clientKinds[2],
  total: clientKinds[3],
} as const;

/** @canonical-values db.metric-key */
export const metricKeys = [
  "member_count",
  "message_count",
  "paid_member_count",
  "wiki_session_count",
] as const;
export const METRIC_KEY = {
  memberCount: metricKeys[0],
  messageCount: metricKeys[1],
  paidMemberCount: metricKeys[2],
  wikiSessionCount: metricKeys[3],
} as const;

/** @canonical-values db.metric-period */
export const metricPeriods = ["daily", "weekly"] as const;
export const METRIC_PERIOD = { daily: metricPeriods[0], weekly: metricPeriods[1] } as const;
