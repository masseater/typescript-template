import { eq } from "drizzle-orm";
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
export { AUDIT_ACTION, auditEvent, onboardingSteps, schema } from "./schema.ts";
export { UserNotFound } from "./user-not-found.ts";
export type { UserRecord } from "./identity-schema.ts";
export { RateLimitExceeded, consumeRateLimit } from "./rate-limit.ts";
export { checkDatabase };
export {
  claimMailSlot,
  findPasskeyUser,
  findUser,
  findWikiReader,
  hasEnrolledFactor,
  hasVerificationAudience,
  lookupSessionByToken,
  markSessionStrong,
  revokeUserSessions,
} from "./security.ts";
export {
  AgreementRequired,
  AgreementVersionUnavailable,
  acceptAgreementVersions,
  acceptedAgreements,
  pendingAgreementKinds,
  pendingAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  requireSignupAgreements,
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
