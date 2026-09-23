import { Button, Field, FormColumn } from "@repo/ui";

import { useNewInquiryForm } from "#pages/support/model/new-inquiry-form.ts";
import { maximumBodyLength, maximumSubjectLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function NewInquiryForm({
  onCancel,
  onCreated,
}: Readonly<{ onCancel: () => void; onCreated: (inquiryId: string) => void }>): ReactElement {
  const form = useNewInquiryForm(onCreated);
  return (
    <form onSubmit={form.handleSubmit}>
      <FormColumn>
        <Field
          label="件名"
          maxLength={maximumSubjectLength}
          name="subject"
          onValueChange={form.handleSubjectChange}
          required
          value={form.subject}
        />
        <Field
          label="内容"
          maxLength={maximumBodyLength}
          multiline
          name="body"
          onValueChange={form.handleBodyChange}
          required
          value={form.body}
        />
        <div className="flex gap-2">
          <Button disabled={form.blocked} type="submit">
            送信
          </Button>
          <Button disabled={form.pending} onClick={onCancel} type="button" variant="secondary">
            戻る
          </Button>
        </div>
        {form.error !== undefined && <p className="text-sm text-destructive">{form.error}</p>}
      </FormColumn>
    </form>
  );
}

export { NewInquiryForm };
