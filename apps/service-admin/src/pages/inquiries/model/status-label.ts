import { INQUIRY_STATUS } from "@repo/config/inquiry";

import type { InquiryStatus } from "@repo/config/inquiry";

const inquiryStatusLabels: Readonly<Record<InquiryStatus, string>> = {
  answered: "対応中",
  closed: "完了",
  open: "受付",
};

function inquiryStatusLabel(status: InquiryStatus): string {
  return inquiryStatusLabels[status];
}

function isInquiryClosed(status: InquiryStatus): boolean {
  return status === INQUIRY_STATUS.closed;
}

export { INQUIRY_STATUS, inquiryStatusLabel, isInquiryClosed };
export type { InquiryStatus };
