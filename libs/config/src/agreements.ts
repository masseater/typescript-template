/** @canonical-values config.agreement-kind */
export const agreementKinds = ["terms", "privacy", "interview_history"] as const;
export type AgreementKind = (typeof agreementKinds)[number];
export const AGREEMENT_KIND = {
  terms: agreementKinds[0],
  privacy: agreementKinds[1],
  interview_history: agreementKinds[2],
} as const satisfies Record<string, AgreementKind>;

export interface AgreementPolicy {
  readonly blocksUntilReaccepted: boolean;
  readonly requiredAtSignup: boolean;
  readonly withdrawable: boolean;
}

export const agreementPolicies = {
  interview_history: {
    blocksUntilReaccepted: false,
    requiredAtSignup: false,
    withdrawable: true,
  },
  privacy: { blocksUntilReaccepted: false, requiredAtSignup: true, withdrawable: false },
  terms: { blocksUntilReaccepted: true, requiredAtSignup: true, withdrawable: false },
} as const satisfies Readonly<Record<AgreementKind, AgreementPolicy>>;
