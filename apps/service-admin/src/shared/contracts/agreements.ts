import { agreementKinds } from "@repo/config";
import { Identifier, IdentifierQuery } from "@repo/runtime/contracts";
import { Schema } from "effect";

const maximumVersionLength = 64;
const maximumSummaryLength = 500;
const maximumBodyLength = 100_000;

const AgreementKind = Schema.Literals(agreementKinds);
const versionLabelPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const VersionLabel = Schema.Trim.check(
  Schema.isLengthBetween(1, maximumVersionLength),
  Schema.isPattern(versionLabelPattern),
);
const Summary = Schema.String.check(Schema.isLengthBetween(0, maximumSummaryLength));
const Body = Schema.String.check(Schema.isLengthBetween(1, maximumBodyLength));

const AgreementVersionSummary = Schema.Struct({
  createdAt: Schema.Finite,
  id: Schema.String,
  kind: AgreementKind,
  publishedAt: Schema.NullOr(Schema.Finite),
  summary: Schema.NullOr(Schema.String),
  version: Schema.String,
});

const AgreementVersionList = Schema.Struct({
  canPublish: Schema.Boolean,
  versions: Schema.Array(AgreementVersionSummary),
});

const AgreementVersionDetail = Schema.Struct({
  ...AgreementVersionSummary.fields,
  body: Schema.String,
  canPublish: Schema.Boolean,
});

const AgreementVersionQuery = Schema.Struct({ version: VersionLabel });

const AgreementDraft = Schema.Struct({
  body: Body,
  kind: AgreementKind,
  summary: Schema.optionalKey(Summary),
  version: VersionLabel,
});

const AgreementDraftRevision = Schema.Struct({
  body: Body,
  id: Identifier,
  summary: Schema.optionalKey(Summary),
});

const AgreementVersionSaved = Schema.Struct({ id: Schema.String, version: Schema.String });

const AgreementPublication = IdentifierQuery;

const AgreementPublished = Schema.Struct({
  id: Schema.String,
  kind: AgreementKind,
  version: Schema.String,
});

export {
  AgreementDraft,
  AgreementDraftRevision,
  AgreementPublication,
  AgreementPublished,
  AgreementVersionDetail,
  AgreementVersionList,
  AgreementVersionQuery,
  AgreementVersionSaved,
  maximumBodyLength,
  maximumSummaryLength,
  maximumVersionLength,
  versionLabelPattern,
};
