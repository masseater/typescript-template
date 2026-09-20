import { Button, ConfirmDialog, Field, FormColumn, useToast } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { publicationConsequence } from "#pages/terms/model/agreement-labels.ts";
import { useDraftForm } from "#pages/terms/model/draft-form.ts";
import { maximumBodyLength, maximumSummaryLength } from "#shared/contracts/index.ts";

import type { VersionDetail } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

function DraftEditor({
  onSaved,
  version,
}: Readonly<{ onSaved: () => void; version: VersionDetail }>): ReactElement {
  const navigate = useNavigate();
  const notify = useToast();
  const [confirming, setConfirming] = useState(false);
  const form = useDraftForm(version, {
    onPublished: async (published) => {
      notify("success", `${published} を公開しました。`);
      await navigate({ search: {}, to: "/terms" });
    },
    onSaved: () => {
      notify("success", "草稿を保存しました。");
      onSaved();
    },
  });

  return (
    <>
      <FormColumn>
        <Field
          label="本文"
          maxLength={maximumBodyLength}
          multiline
          name="body"
          onValueChange={form.handleBodyChange}
          required
          value={form.body}
        />
        <Field
          label="変更の要約"
          maxLength={maximumSummaryLength}
          name="summary"
          onValueChange={form.handleSummaryChange}
          value={form.summary}
        />
      </FormColumn>
      {form.error !== undefined && <p className="text-sm text-destructive">{form.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={form.blocked} onClick={form.handleSave} type="button">
          草稿を保存
        </Button>
        {version.canPublish && (
          <Button
            disabled={form.blocked}
            onClick={() => setConfirming(true)}
            type="button"
            variant="primary"
          >
            公開する
          </Button>
        )}
      </div>
      <ConfirmDialog
        confirmLabel="公開する"
        description={`${version.version} を公開します。${publicationConsequence(version.kind)}`}
        onConfirm={() => {
          setConfirming(false);
          form.handlePublish();
        }}
        onOpenChange={setConfirming}
        open={confirming}
        title="この版を公開しますか？"
      />
    </>
  );
}

export { DraftEditor };
