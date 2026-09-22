import { agreementPolicies, type AgreementKind } from "@repo/config";

import type { AgreementsView, PendingAgreement } from "#shared/contracts/index.ts";

type Agreements = typeof AgreementsView.Type;
type Pending = typeof PendingAgreement.Type;

const agreementKindLabels: Readonly<Record<AgreementKind, string>> = {
  privacy: "プライバシーポリシー",
  terms: "利用規約",
};

const agreementKindPaths = {
  privacy: "/privacy",
  terms: "/terms",
} as const satisfies Readonly<Record<AgreementKind, string>>;

const blocksMember = (pending: readonly Pending[]): boolean =>
  pending.some((agreement) => agreementPolicies[agreement.kind].blocksUntilReaccepted);

export { agreementKindLabels, agreementKindPaths, blocksMember };
export type { Agreements, Pending };
