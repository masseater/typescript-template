import { agreementKindLabels, agreementPolicies, type AgreementKind } from "@repo/config";

const stateLabel = (publishedAt: number | null): string =>
  publishedAt === null ? "草稿" : "公開済み";

const publicationConsequence = (kind: AgreementKind): string =>
  agreementPolicies[kind].blocksUntilReaccepted
    ? "公開すると、会員は次の操作の前にこの版への再同意を求められます。"
    : `${agreementKindLabels[kind]}の公開だけでは、会員に再同意を求めません。`;

export { agreementKindLabels, publicationConsequence, stateLabel };
