import { INQUIRY_STATUS, type InquiryStatus } from "@repo/config";

const inquiryStatusLabels: Readonly<Record<InquiryStatus, string>> = {
  [INQUIRY_STATUS.answered]: "対応中",
  [INQUIRY_STATUS.closed]: "完了",
  [INQUIRY_STATUS.open]: "受付",
};

function inquiryStatusLabel(status: InquiryStatus): string {
  return inquiryStatusLabels[status];
}

function isInquiryClosed(status: InquiryStatus): boolean {
  return status === INQUIRY_STATUS.closed;
}

export { INQUIRY_STATUS, inquiryStatusLabel, isInquiryClosed };
export type { InquiryStatus };
