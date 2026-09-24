import { useRouter } from "@tanstack/react-router";

import { useReplyForm } from "#pages/messages/model/reply-form.ts";
import { maximumMessageBodyLength } from "#shared/contracts/index.ts";
import { ReplyBodyForm } from "#shared/ui/index.ts";

import type { ReactElement } from "react";
function ReplyForm({
  conversationId,
}: Readonly<{
  conversationId: string;
}>): ReactElement {
  const router = useRouter();
  function showSent(): Promise<void> {
    return router.invalidate().then(() => undefined);
  }
  const form = useReplyForm(conversationId, showSent);
  return (
    <ReplyBodyForm
      form={form}
      label="メッセージ"
      maxLength={maximumMessageBodyLength}
      submitLabel="送信する"
    />
  );
}
export { ReplyForm };
