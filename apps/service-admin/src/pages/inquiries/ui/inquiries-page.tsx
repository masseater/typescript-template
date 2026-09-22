import { useAtomValue } from "@effect/atom-react";
import { NavigationLink, STATUS_VARIANT, StatusMessage, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { useInquiryList, useInquiryStatusFilter } from "#pages/inquiries/model/inquiry-list.ts";
import { INQUIRY_STATUS, inquiryStatusLabel } from "#pages/inquiries/model/status-label.ts";
import { pendingCountAtom } from "#shared/api/index.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";

import type { ReactElement } from "react";

const updatedAtLabel = new Intl.DateTimeFormat("ja", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const statusFilters = [
  INQUIRY_STATUS.open,
  INQUIRY_STATUS.answered,
  INQUIRY_STATUS.closed,
] as const;

function InquiriesPage(): ReactElement {
  const { status, toggle } = useInquiryStatusFilter();
  const listing = useInquiryList(status);
  const pendingState = useAtomValue(pendingCountAtom);
  const error = resultError(listing) ?? resultError(pendingState);
  const inquiries = AsyncResult.isSuccess(listing) ? listing.value : undefined;
  const pendingCount = AsyncResult.isSuccess(pendingState) ? pendingState.value : undefined;

  return (
    <OpsPage title="問い合わせ">
      {pendingCount !== undefined && (
        <p className="text-sm leading-normal text-muted-foreground">対応待ち: {pendingCount} 件</p>
      )}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => {
              toggle(value);
            }}
            className={`rounded-md border px-3 py-1 text-sm ${status === value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {inquiryStatusLabel(value)}
          </button>
        ))}
      </div>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
      {inquiries === undefined && error === undefined && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {inquiries !== undefined && inquiries.length === 0 && (
        <StatusMessage variant={STATUS_VARIANT.empty}>
          条件に一致する問い合わせはありません。
        </StatusMessage>
      )}
      {inquiries !== undefined && inquiries.length > 0 && (
        <table aria-label="問い合わせの一覧" className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-2">件名</th>
              <th className="p-2">経路</th>
              <th className="p-2">状態</th>
              <th className="p-2">相手</th>
              <th className="p-2">最終更新</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inquiry) => (
              <tr key={inquiry.id} className="border-b border-border">
                <td className="p-2">
                  <NavigationLink to="/inquiries/$id" params={{ id: inquiry.id }} variant="item">
                    {inquiry.subject}
                  </NavigationLink>
                </td>
                <td className="p-2">会員</td>
                <td className="p-2">{inquiryStatusLabel(inquiry.status)}</td>
                <td className="p-2">{inquiry.memberName}</td>
                <td className="p-2">{updatedAtLabel.format(inquiry.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsPage>
  );
}

export { InquiriesPage };
