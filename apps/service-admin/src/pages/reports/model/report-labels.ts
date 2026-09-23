import { REPORT_REASON, REPORT_STATUS } from "@repo/config";

const reasonLabel = {
  [REPORT_REASON.harassment]: "迷惑行為",
  [REPORT_REASON.other]: "その他",
  [REPORT_REASON.spam]: "スパム",
} as const;

const statusLabel = {
  [REPORT_STATUS.actioned]: "処置済み",
  [REPORT_STATUS.dismissed]: "却下",
  [REPORT_STATUS.open]: "未対応",
} as const;

export { reasonLabel, statusLabel };
