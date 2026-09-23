/** @canonical-values config.inquiry-status */
export const inquiryStatuses = ["inquiry_open", "inquiry_answered", "inquiry_closed"] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];
export const INQUIRY_STATUS = {
  answered: inquiryStatuses[1],
  closed: inquiryStatuses[2],
  open: inquiryStatuses[0],
} as const satisfies Record<string, InquiryStatus>;
export const inquiryStatusLabels: Readonly<Record<InquiryStatus, string>> = {
  [INQUIRY_STATUS.answered]: "対応中",
  [INQUIRY_STATUS.closed]: "完了",
  [INQUIRY_STATUS.open]: "受付",
};
