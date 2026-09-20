import { Button, ConfirmDialog, Field, FormColumn, useAction, useToast } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { publishVersion, reviseDraft } from "#pages/terms/api/agreement-versions.ts";
import { publicationConsequence } from "#pages/terms/model/agreement-labels.ts";
import { maximumBodyLength, maximumSummaryLength } from "#shared/contracts/index.ts";

import type { VersionDetail } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

function DraftEditor({
  onSaved,
  version,
}: Readonly<{ onSaved: () => void; version: VersionDetail }>): ReactElement {
  const navigate = useNavigate();
  const notify = useToast();
  const action = useAction();
  const [body, setBody] = useState(version.body);
  const [summary, setSummary] = useState(version.summary ?? "");
  const [confirming, setConfirming] = useState(false);

  const save = (): void => {
    action.run(async () => {
      await reviseDraft({ body, id: version.id, summary });
      notify("success", "草稿を保存しました。");
      onSaved();
    });
  };

  const publish = (): void => {
    setConfirming(false);
    action.run(async () => {
      await reviseDraft({ body, id: version.id, summary });
      const published = await publishVersion(version.id);
      notify("success", `${published.version} を公開しました。`);
      await navigate({ search: {}, to: "/terms" });
    });
  };

  return (
    <>
      <FormColumn>
        <Field
          label="本文"
          maxLength={maximumBodyLength}
          multiline
          name="body"
          onValueChange={setBody}
          required
          value={body}
        />
        <Field
          label="変更の要約"
          maxLength={maximumSummaryLength}
          name="summary"
          onValueChange={setSummary}
          value={summary}
        />
      </FormColumn>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={action.blocked || body.trim() === ""} onClick={save} type="button">
          草稿を保存
        </Button>
        {version.canPublish && (
          <Button
            disabled={action.blocked || body.trim() === ""}
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
        onConfirm={publish}
        onOpenChange={setConfirming}
        open={confirming}
        title="この版を公開しますか？"
      />
    </>
  );
}

export { DraftEditor };
