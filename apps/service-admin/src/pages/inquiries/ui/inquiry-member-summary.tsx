import { Heading, STATUS_VARIANT, StatusMessage, TextLink, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { useMemberSummary } from "#pages/inquiries/model/inquiry-thread.ts";

import type { ReactElement } from "react";

function InquiryMemberSummary({ memberId }: Readonly<{ memberId: string }>): ReactElement {
  const summary = useMemberSummary(memberId);
  const failure = resultError(summary);
  return (
    <aside aria-label="利用者の要約" className="flex flex-col gap-2 border-l border-border pl-4">
      <Heading as="h2" size="section">
        利用者
      </Heading>
      {failure !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{failure}</StatusMessage>
      )}
      {failure === undefined && !AsyncResult.isSuccess(summary) && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {AsyncResult.isSuccess(summary) && (
        <>
          <p className="text-base leading-normal font-medium">{summary.value.name}</p>
          <p className="text-sm leading-normal text-muted-foreground">{summary.value.email}</p>
          <TextLink to="/members/$id" params={{ id: summary.value.id }}>
            利用者の詳細
          </TextLink>
        </>
      )}
    </aside>
  );
}

export { InquiryMemberSummary };
