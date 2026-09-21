/** @canonical-values config.inquiry-status */
export const inquiryStatuses = ["open", "answered", "closed"] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];
export const INQUIRY_STATUS = {
  answered: inquiryStatuses[1],
  closed: inquiryStatuses[2],
  open: inquiryStatuses[0],
} as const;
