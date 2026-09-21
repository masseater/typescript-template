import { ACCOUNT_STATE } from "@repo/config";

import { AccountState } from "#shared/contracts/index.ts";

const accountStateLabels: Readonly<Record<typeof AccountState.Type, string>> = {
  [ACCOUNT_STATE.active]: "利用中",
  [ACCOUNT_STATE.suspended]: "停止中",
};

const nextAccountStates: Readonly<Record<typeof AccountState.Type, typeof AccountState.Type>> = {
  [ACCOUNT_STATE.active]: ACCOUNT_STATE.suspended,
  [ACCOUNT_STATE.suspended]: ACCOUNT_STATE.active,
};

const stateChangeLabels: Readonly<Record<typeof AccountState.Type, string>> = {
  [ACCOUNT_STATE.active]: "利用を停止する",
  [ACCOUNT_STATE.suspended]: "停止を解除する",
};

const verificationLabels = { false: "未確認", true: "確認済み" } as const;

const accountStateOptions = [
  { label: "すべて", value: "" },
  ...AccountState.literals.map((state) => ({ label: accountStateLabels[state], value: state })),
];

const verificationOptions = [
  { label: "すべて", value: "" },
  { label: verificationLabels.true, value: "true" },
  { label: verificationLabels.false, value: "false" },
];

export {
  accountStateLabels,
  accountStateOptions,
  nextAccountStates,
  stateChangeLabels,
  verificationLabels,
  verificationOptions,
};
