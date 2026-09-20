import { Schema } from "effect";

/** @canonical-values db.agreement-kind */
const agreementKinds = ["terms", "privacy", "interview_history", "analytics"] as const;

const AgreementKind = Schema.Literals(agreementKinds);

const AgreementView = Schema.Struct({
  privacyAccepted: Schema.Boolean,
  privacySummary: Schema.NullOr(Schema.String),
  privacyVersion: Schema.NullOr(Schema.String),
  step: Schema.Literals(["agreement", "choose", "profile", "interview", "done"]),
  termsAccepted: Schema.Boolean,
  termsSummary: Schema.NullOr(Schema.String),
  termsVersion: Schema.NullOr(Schema.String),
});

const AgreementAccept = Schema.Union([
  Schema.Struct({ purpose: Schema.Literal("registration") }),
  Schema.Struct({ kind: AgreementKind, purpose: Schema.Literal("version") }),
]);

const LeaveRequest = Schema.Struct({
  immediate: Schema.Boolean,
});

const LeaveResult = Schema.Struct({
  left: Schema.Literal(true),
});

const RestorationView = Schema.Struct({
  purgeAt: Schema.NullOr(Schema.Number),
  restorable: Schema.Boolean,
});

const RestorationResult = Schema.Struct({
  restored: Schema.Literal(true),
});

const EmailChangeRequest = Schema.Struct({
  email: Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u)),
});

const EmailChangePending = Schema.Struct({
  pending: Schema.Literal(true),
});

const EmailChangeConfirm = Schema.Struct({
  token: Schema.String.check(Schema.isMinLength(1)),
});

const EmailChangeConfirmed = Schema.Struct({
  email: Schema.String,
});

const MemberMessage = Schema.Struct({
  body: Schema.String,
  id: Schema.String,
  senderLabel: Schema.String,
});

const MemberMessageList = Schema.Struct({
  messages: Schema.Array(MemberMessage),
});

const LegalQuery = Schema.Struct({
  kind: Schema.Literals(["privacy", "terms"]),
});

const PublishedAgreement = Schema.Struct({
  body: Schema.String,
  kind: Schema.Literals(["privacy", "terms"]),
  summary: Schema.NullOr(Schema.String),
  version: Schema.String,
});

export {
  AgreementAccept,
  AgreementView,
  EmailChangeConfirm,
  EmailChangeConfirmed,
  EmailChangePending,
  EmailChangeRequest,
  LeaveRequest,
  LeaveResult,
  LegalQuery,
  MemberMessageList,
  PublishedAgreement,
  RestorationResult,
  RestorationView,
};
export { agreementKinds };
