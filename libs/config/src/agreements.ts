/** @canonical-values config.agreement-kind */
export const agreementKinds = ["terms", "privacy"] as const;
export type AgreementKind = (typeof agreementKinds)[number];
export const AGREEMENT_KIND = {
  terms: agreementKinds[0],
  privacy: agreementKinds[1],
} as const satisfies Record<string, AgreementKind>;

export interface AgreementPolicy {
  readonly blocksUntilReaccepted: boolean;
  readonly requiredAtSignup: boolean;
}

export const agreementPolicies = {
  privacy: { blocksUntilReaccepted: false, requiredAtSignup: true },
  terms: { blocksUntilReaccepted: true, requiredAtSignup: true },
} as const satisfies Readonly<Record<AgreementKind, AgreementPolicy>>;

export const blockingAgreementKinds: readonly AgreementKind[] = agreementKinds.filter(
  (kind) => agreementPolicies[kind].blocksUntilReaccepted,
);

export const signupAgreementKinds: readonly AgreementKind[] = agreementKinds.filter(
  (kind) => agreementPolicies[kind].requiredAtSignup,
);
