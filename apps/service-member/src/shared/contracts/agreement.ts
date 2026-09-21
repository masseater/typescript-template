import { agreementKinds } from "@repo/config";
import { Schema } from "effect";

const maximumIdentifierLength = 256;

const AgreementKind = Schema.Literals(agreementKinds);

const PendingAgreement = Schema.Struct({
  id: Schema.String,
  kind: AgreementKind,
  publishedAt: Schema.Number,
  summary: Schema.NullOr(Schema.String),
  version: Schema.String,
});

const AcceptedAgreement = Schema.Struct({
  acceptedAt: Schema.Number,
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

const PublishedAgreementQuery = Schema.Struct({ kind: AgreementKind });

const PublishedAgreementView = Schema.Struct({
  body: Schema.String,
  kind: AgreementKind,
  publishedAt: Schema.Number,
  summary: Schema.NullOr(Schema.String),
  version: Schema.String,
});

export {
  AgreementAcceptance,
  AgreementsView,
  PendingAgreement,
  PublishedAgreementQuery,
  PublishedAgreementView,
};
