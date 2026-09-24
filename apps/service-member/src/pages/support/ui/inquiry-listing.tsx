import {
  Heading,
  NavigationLink,
  STATUS_VARIANT,
  StatusMessage,
  formatWarekiDateTime,
} from "@repo/ui";

import type { InquirySummary } from "#pages/support/model/inquiry.ts";
import type { ReactElement } from "react";

function InquiryEntries({
  error,
  inquiries,
}: Readonly<{
  error: string | undefined;
  inquiries: readonly InquirySummary[] | undefined;
}>): ReactElement | undefined {
  if (inquiries === undefined) {
    return error === undefined ? (
      <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
    ) : undefined;
  }
  if (inquiries.length === 0) {
    return (
      <StatusMessage variant={STATUS_VARIANT.pending}>まだ問い合わせはありません。</StatusMessage>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {inquiries.map((inquiry) => (
        <li key={inquiry.id}>
          <NavigationLink to="/support/$id" params={{ id: inquiry.id }} variant="item">
            <Heading as="h2" size="block">
              {inquiry.subject}
            </Heading>
            <p className="text-sm leading-normal text-muted-foreground">
              {inquiry.statusLabel}・{formatWarekiDateTime(inquiry.updatedAt.getTime())}
            </p>
          </NavigationLink>
        </li>
      ))}
    </ul>
  );
}

function InquiryListing({
  error,
  inquiries,
}: Readonly<{
  error: string | undefined;
  inquiries: readonly InquirySummary[] | undefined;
}>): ReactElement {
  return (
    <>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      <InquiryEntries error={error} inquiries={inquiries} />
    </>
  );
}

export { InquiryListing };
