import { Schema } from "effect";

import { ROLE } from "./identity.ts";

/** @canonical-values config.inquiry-author-kind */
export const inquiryAuthorKinds = [ROLE.member, ROLE.administrator] as const;
export const InquiryAuthorKind = Schema.Literals(inquiryAuthorKinds);
export type InquiryAuthorKind = typeof InquiryAuthorKind.Type;
export const INQUIRY_AUTHOR_KIND = {
  admin: ROLE.administrator,
  member: ROLE.member,
} as const satisfies Record<string, InquiryAuthorKind>;
export const inquiryAuthorKindLabels: Readonly<Record<InquiryAuthorKind, string>> = {
  [INQUIRY_AUTHOR_KIND.admin]: "運営",
  [INQUIRY_AUTHOR_KIND.member]: "会員",
};
