import { agreementPolicies, type AgreementKind } from "@repo/config";

import type { AgreementsView, PendingAgreement } from "#shared/contracts/index.ts";

type Agreements = typeof AgreementsView.Type;
type Pending = typeof PendingAgreement.Type;

const agreementKindLabels: Readonly<Record<AgreementKind, string>> = {
  interview_history: "AI インタビューの履歴の利用",
  privacy: "プライバシーポリシー",
  terms: "利用規約",
};

const agreementKindPaths = {
  interview_history: "/settings/agreements",
  privacy: "/privacy",
  terms: "/terms",
} as const satisfies Readonly<Record<AgreementKind, string>>;

const signupAgreementKinds = (pending: readonly Pending[]): readonly Pending[] =>
  pending.filter((agreement) => agreementPolicies[agreement.kind].requiredAtSignup);

const blocksMember = (pending: readonly Pending[]): boolean =>
  pending.some((agreement) => agreementPolicies[agreement.kind].blocksUntilReaccepted);

export { agreementKindLabels, agreementKindPaths, blocksMember, signupAgreementKinds };
export type { Agreements, Pending };
