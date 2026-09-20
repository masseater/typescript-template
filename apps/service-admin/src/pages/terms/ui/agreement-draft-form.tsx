import { AGREEMENT_KIND, agreementKinds, type AgreementKind } from "@repo/config";
import { Button, Field, FormColumn, Heading, SelectField, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { createDraft } from "#pages/terms/api/agreement-versions.ts";
import { agreementKindLabels } from "#pages/terms/model/agreement-labels.ts";
import {
  maximumBodyLength,
  maximumSummaryLength,
  maximumVersionLength,
  versionLabelPattern,
} from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

const kindOptions = agreementKinds.map((kind) => ({
  label: agreementKindLabels[kind],
  value: kind,
}));

const isKind = (value: string): value is AgreementKind =>
  agreementKinds.some((kind) => kind === value);

function AgreementDraftForm(): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const [kind, setKind] = useState<AgreementKind>(AGREEMENT_KIND.terms);
  const [version, setVersion] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <Heading as="h2" size="section">
        新しい草稿
      </Heading>
      <FormColumn>
        <SelectField
          label="種類"
          name="kind"
          onValueChange={(value) => {
            if (isKind(value)) {
              setKind(value);
            }
          }}
          options={kindOptions}
          value={kind}
        />
        <Field
          label="版"
          maxLength={maximumVersionLength}
          name="version"
          onValueChange={setVersion}
          pattern={versionLabelPattern.source}
          required
          value={version}
        />
        <Field
          label="変更の要約"
          maxLength={maximumSummaryLength}
          name="summary"
          onValueChange={setSummary}
          value={summary}
        />
        <Field
          label="本文"
          maxLength={maximumBodyLength}
          multiline
          name="body"
          onValueChange={setBody}
          required
          value={body}
        />
      </FormColumn>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <Button
        disabled={action.blocked || version.trim() === "" || body.trim() === ""}
        onClick={() => {
          action.run(async () => {
            const saved = await createDraft({ body, kind, summary, version });
            await navigate({ params: { version: saved.version }, to: "/terms/$version" });
          });
        }}
        type="button"
        variant="primary"
      >
        草稿を保存
      </Button>
    </section>
  );
}

export { AgreementDraftForm };
