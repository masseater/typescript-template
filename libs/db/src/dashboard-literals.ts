/** @canonical-values db.audit-action */
export const auditActions = [
  "flag_toggled",
  "role_changed",
  "user_deleted",
  "agreement_published",
  "member_suspended",
  "member_unsuspended",
  "admin_invited",
  "admin_permission_changed",
  "admin_disabled",
  "admin_enabled",
  "staff_invited",
  "staff_permission_changed",
  "staff_removed",
  "invite_accepted",
] as const;
export const AUDIT_ACTION = {
  flagToggled: auditActions[0],
  roleChanged: auditActions[1],
  userDeleted: auditActions[2],
  agreementPublished: auditActions[3],
  memberSuspended: auditActions[4],
  memberUnsuspended: auditActions[5],
  adminInvited: auditActions[6],
  adminPermissionChanged: auditActions[7],
  adminDisabled: auditActions[8],
  adminEnabled: auditActions[9],
  staffInvited: auditActions[10],
  staffPermissionChanged: auditActions[11],
  staffRemoved: auditActions[12],
  inviteAccepted: auditActions[13],
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
