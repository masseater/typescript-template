import { agreementKinds } from "@repo/config";
import {
  AgreementRequired,
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
} from "@repo/db";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { SessionIdentityMiddleware, SessionInvalid, SessionRequired } from "./session-identity.ts";

const AgreementKind = Schema.Literals(agreementKinds);
const maximumIdentifierLength = 256;

const PendingAgreement = Schema.Struct({
  id: Schema.String,
  kind: AgreementKind,
  publishedAt: Schema.Finite,
  summary: Schema.NullOr(Schema.String),
  version: Schema.String,
});

const AcceptedAgreement = Schema.Struct({
  acceptedAt: Schema.Finite,
  kind: AgreementKind,
  version: Schema.String,
  versionId: Schema.String,
});

const AgreementsView = Schema.Struct({
  accepted: Schema.Array(AcceptedAgreement),
  pending: Schema.Array(PendingAgreement),
});

const AgreementAcceptance = Schema.Struct({
  versionIds: Schema.Array(
    Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength)),
  ).check(Schema.isLengthBetween(1, agreementKinds.length)),
});

const PublishedAgreementView = Schema.Struct({
  body: Schema.String,
  kind: AgreementKind,
  publishedAt: Schema.Finite,
  summary: Schema.NullOr(Schema.String),
  version: Schema.String,
});

const SessionError = Schema.Union([SessionRequired, SessionInvalid]);

const listAgreements = Rpc.make("listAgreements", {
  error: SessionError,
  payload: {},
  success: AgreementsView,
}).middleware(SessionIdentityMiddleware);

const acceptAgreements = Rpc.make("acceptAgreements", {
  error: Schema.Union([AgreementVersionUnavailable, SessionRequired, SessionInvalid]),
  payload: AgreementAcceptance,
  success: AgreementsView,
}).middleware(SessionIdentityMiddleware);

const publishedAgreement = Rpc.make("publishedAgreement", {
  error: AgreementVersionUnavailable,
  payload: { kind: AgreementKind },
  success: PublishedAgreementView,
});

const withdrawAgreement = Rpc.make("withdrawAgreement", {
  error: Schema.Union([AgreementWithdrawalUnavailable, SessionRequired, SessionInvalid]),
  payload: { kind: AgreementKind },
  success: AgreementsView,
}).middleware(SessionIdentityMiddleware);

const requireCurrentAgreements = Rpc.make("requireCurrentAgreements", {
  error: Schema.Union([AgreementRequired, SessionRequired, SessionInvalid]),
  payload: {},
  success: Schema.Void,
}).middleware(SessionIdentityMiddleware);

export class MemberAgreementRpcs extends RpcGroup.make(
  listAgreements,
  acceptAgreements,
  publishedAgreement,
  withdrawAgreement,
  requireCurrentAgreements,
) {}

export {
  AcceptedAgreement,
  AgreementAcceptance,
  AgreementsView,
  PendingAgreement,
  PublishedAgreementView,
  acceptAgreements,
  listAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  withdrawAgreement,
};
