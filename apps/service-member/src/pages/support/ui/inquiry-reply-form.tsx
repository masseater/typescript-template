import { Button, Field, FormColumn } from "@repo/ui";

import { useReplyForm } from "#pages/support/model/reply-form.ts";
import { maximumBodyLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function InquiryReplyForm({
  inquiryId,
  onReplied,
}: Readonly<{ inquiryId: string; onReplied: () => void }>): ReactElement {
  const form = useReplyForm(inquiryId, onReplied);
  return (
    <form onSubmit={form.handleSubmit}>
      <FormColumn>
        <Field
          label="追加の内容"
          maxLength={maximumBodyLength}
          multiline
          name="body"
          onValueChange={form.handleBodyChange}
          value={form.body}
        />
        <Button disabled={form.blocked} type="submit">
          送る
        </Button>
        {form.error !== undefined && <p className="text-sm text-destructive">{form.error}</p>}
      </FormColumn>
    </form>
  );
}

export { InquiryReplyForm };
