import { Effect } from "effect";

import { query } from "./database.ts";
import { user } from "./schema.ts";

const checkDatabase = Effect.fn("checkDatabase")(function* checkDatabase() {
  yield* query((database) => database.select({ id: user.id }).from(user).limit(1));
});

export { containsKeyword } from "./contains-keyword.ts";
export { Database, query } from "./database.ts";
export { DatabaseFailure } from "./database-failure.ts";
export type { DrizzleDatabase } from "./database.ts";
export { and, count, desc, eq, gt, inArray, isNull, ne, not, or, sql } from "drizzle-orm";
export { AUDIT_ACTION, auditActions } from "@repo/config";
export {
  AUDIT_CHANNEL,
  CONVERSATION_KIND,
  GROUP_JOIN_POLICY,
  GROUP_MEMBERSHIP_ROLE,
  INQUIRY_AUTHOR_KIND,
  INQUIRY_STATUS,
  NOTIFICATION_KIND,
  auditEvent,
  inquiryAuthorKinds,
  inquiryStatuses,
  notificationKinds,
  onboardingSteps,
  schema,
} from "./schema.ts";
export type { NotificationKind } from "./schema.ts";
export { UserNotFound } from "./user-not-found.ts";
export type { UserRecord } from "./identity-schema.ts";
export { RateLimitExceeded, consumeRateLimit } from "./rate-limit.ts";
export { checkDatabase };
export { InviteRejected } from "./invite-rejected.ts";
export { acceptInvite, previewInvite } from "./invite.ts";
export {
  claimMailSlot,
  findPasskeyUser,
  findUser,
  findWikiReader,
  getSessionSecurity,
  hasEnrolledFactor,
  hasVerificationAudience,
  lookupSessionByToken,
  markSessionStrong,
  revokeUserSessions,
} from "./security.ts";
export {
  canViewProfile,
  clearPhotoKeys,
  photoKeysOf,
  profileListed,
  profileVisibleTo,
  readVisibility,
  setPhotoKey,
  updateVisibility,
  visiblePhotoKey,
} from "./member-profile.ts";
export type { PhotoKeys, VisibilitySettings } from "./member-profile.ts";
export {
  AgreementRequired,
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
  acceptAgreementVersions,
  acceptedAgreements,
  hasAcceptedLatestAgreement,
  pendingAgreementKinds,
  pendingAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  requireSignupAgreements,
  withdrawAgreementKind,
} from "./agreement.ts";
export type { AcceptedAgreement, PublishedAgreement } from "./agreement.ts";
export {
  InterviewConflict,
  InterviewLimitReached,
  countInterviewTurn,
  findInterview,
  startInterview,
  storeInterview,
} from "./interview.ts";
export {
  InquiryForbidden,
  InquiryNotFound,
  InquiryPage,
  closeInquiry,
  countPendingInquiries,
  createMemberInquiry,
  getAdminInquiry,
  getInquiryMemberSummary,
  getMemberInquiry,
  listAdminInquiries,
  listMemberInquiries,
  replyAsAdmin,
  replyAsMember,
  requireInquiryResponder,
} from "./inquiry.ts";
export type {
  AdminInquirySummary,
  AdminInquiryThread,
  InquiryMessage,
  InquirySummary,
  InquiryThread,
  MemberSummary,
} from "./inquiry.ts";
export {
  MemberLeaveUnavailable,
  RecoveryExpired,
  RecoveryUnavailable,
  acceptRecovery,
  declineRecovery,
  findRecoveryOffer,
  purgeExpiredWithdrawnMembers,
  withdrawMember,
} from "./member-leave.ts";
export {
  AuditPage,
  TrendQuery,
  dashboardStaff,
  refreshMetricSnapshots,
} from "./dashboard-staff.ts";
export type {
  AuditEventView,
  MetricTrendPoint,
  OverviewCard,
  OverviewMetrics,
  ReadOnlyDashboardStaff,
} from "./dashboard-staff.ts";
export { PaidPlanRequired } from "./paid-plan-required.ts";
export {
  attachCheckout,
  findSubscription,
  isPaidMember,
  markPaymentFailed,
  memberOfCustomer,
  planOf,
  recordSubscription,
  requirePaid,
} from "./billing.ts";
export { StripeEventUnreadable, applyStripeWebhookEvent } from "./billing-events.ts";
export type { StripeEventRecord, SubscriptionRecord } from "./billing.ts";
export type { StripeWebhookEvent } from "./billing-events.ts";
export {
  TrustSubjectNotFound,
  TrustTargetUnavailable,
  blockBetween,
  blockHides,
  blockMember,
  fileReport,
  pairBlocked,
  unblockMember,
  viewerBlockedTarget,
} from "./trust.ts";
export {
  dismissReport,
  listReports,
  readReport,
  suspendTarget,
  warnTarget,
} from "./trust-admin.ts";
