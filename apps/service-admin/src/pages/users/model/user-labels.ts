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

function stateChangeConfirmation(
  user: Readonly<{ accountState: typeof AccountState.Type; email: string }>,
): Readonly<{ description: string; variant: "danger" | "primary" }> {
  if (nextAccountStates[user.accountState] === ACCOUNT_STATE.suspended) {
    return {
      description: `${user.email} の利用を停止します。停止中はログインできず、他の利用者から見えなくなります。`,
      variant: "danger",
    };
  }
  return {
    description: `${user.email} の停止を解除します。再びログインでき、他の利用者から見えるようになります。`,
    variant: "primary",
  };
}

function rowConfirmation(
  deleting: boolean,
  user: Readonly<{ accountState: typeof AccountState.Type; email: string }>,
): Readonly<{
  confirmLabel: string;
  description: string;
  title: string;
  variant: "danger" | "primary";
}> {
  if (deleting) {
    return {
      confirmLabel: "削除する",
      description: `${user.email} を削除します。この操作は取り消せません。`,
      title: "ユーザーを削除しますか？",
      variant: "danger",
    };
  }
  const stateChange = stateChangeLabels[user.accountState];
  return { confirmLabel: stateChange, title: `${stateChange}か？`, ...stateChangeConfirmation(user) };
}

export {
  accountStateLabels,
  accountStateOptions,
  nextAccountStates,
  rowConfirmation,
  stateChangeLabels,
  verificationLabels,
  verificationOptions,
};
