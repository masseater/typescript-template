/** @canonical-values db.report-reason */
export const reportReasons = ["report_harassment", "report_other", "report_spam"] as const;
export type ReportReason = (typeof reportReasons)[number];
export const REPORT_REASON = {
  harassment: reportReasons[0],
  other: reportReasons[1],
  spam: reportReasons[2],
} as const;

/** @canonical-values db.report-status */
export const reportStatuses = ["report_actioned", "report_dismissed", "report_open"] as const;
export type ReportStatus = (typeof reportStatuses)[number];
export const REPORT_STATUS = {
  actioned: reportStatuses[0],
  dismissed: reportStatuses[1],
  open: reportStatuses[2],
} as const;

/** @canonical-values db.report-subject */
export const reportSubjects = [
  "report_board_post",
  "report_direct_message",
  "report_group_message",
] as const;
export type ReportSubject = (typeof reportSubjects)[number];
export const REPORT_SUBJECT = {
  boardPost: reportSubjects[0],
  groupMessage: reportSubjects[2],
  message: reportSubjects[1],
} as const;

/** @canonical-values db.moderation-kind */
export const moderationKinds = [
  "moderation_suspend",
  "moderation_unsuspend",
  "moderation_warn",
] as const;
export type ModerationKind = (typeof moderationKinds)[number];
export const MODERATION_KIND = {
  suspend: moderationKinds[0],
  unsuspend: moderationKinds[1],
  warn: moderationKinds[2],
} as const;
