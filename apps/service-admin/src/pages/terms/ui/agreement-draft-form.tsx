import { agreementKinds } from "@repo/config";
import { Button, Field, FormColumn, Heading, SelectField } from "@repo/ui";

import { agreementKindLabels } from "#pages/terms/model/agreement-labels.ts";
import { useNewDraftForm } from "#pages/terms/model/new-draft-form.ts";
import {
  maximumBodyLength,
  maximumSummaryLength,
  maximumVersionLength,
} from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

const kindOptions = agreementKinds.map((kind) => ({
  label: agreementKindLabels[kind],
  value: kind,
}));

function AgreementDraftForm(): ReactElement {
  const form = useNewDraftForm();

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <Heading as="h2" size="section">
        新しい草稿
      </Heading>
      <FormColumn>
        <SelectField
          label="種類"
          name="kind"
          onValueChange={form.handleKindChange}
          options={kindOptions}
          value={form.kind}
        />
        <Field
          label="版"
          maxLength={maximumVersionLength}
          name="version"
          onValueChange={form.handleVersionChange}
          value={form.version}
        />
        <Field
          label="変更の要約"
          maxLength={maximumSummaryLength}
          name="summary"
          onValueChange={form.handleSummaryChange}
          value={form.summary}
        />
        <Field
          label="本文"
          maxLength={maximumBodyLength}
          multiline
          name="body"
          onValueChange={form.handleBodyChange}
          value={form.body}
        />
      </FormColumn>
      {form.error !== undefined && <p className="text-sm text-destructive">{form.error}</p>}
      <Button disabled={form.blocked} onClick={form.handleSave} type="button" variant="primary">
        草稿を保存
      </Button>
    </section>
  );
}

export { AgreementDraftForm };
