import { Button, Field, FormColumn } from "@repo/ui";

import { useReplyForm } from "#pages/inquiries/model/reply-form.ts";
import { maximumBodyLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function InquiryReplyForm({
  inquiryId,
  onChanged,
}: Readonly<{ inquiryId: string; onChanged: () => void }>): ReactElement {
  const form = useReplyForm(inquiryId, onChanged);
  return (
    <form onSubmit={form.handleSubmit}>
      <FormColumn>
        <Field
          label="返信"
          maxLength={maximumBodyLength}
          multiline
          name="body"
          onValueChange={form.handleBodyChange}
          required
          value={form.body}
        />
        <div className="flex gap-2">
          <Button disabled={form.blocked} type="submit">
            返信する
          </Button>
          <Button
            disabled={form.pending}
            onClick={form.handleClose}
            type="button"
            variant="secondary"
          >
            完了にする
          </Button>
        </div>
        {form.error !== undefined && <p className="text-sm text-destructive">{form.error}</p>}
      </FormColumn>
    </form>
  );
}

export { InquiryReplyForm };
