import { useAction } from "@repo/ui";
import { useState } from "react";

import { publishVersion, reviseDraft } from "#pages/terms/api/agreement-versions.ts";

import type { VersionDetail } from "#pages/terms/model/agreement-versions.ts";

interface DraftForm {
  readonly blocked: boolean;
  readonly body: string;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSummaryChange: (value: string) => void;
  readonly handlePublish: () => void;
  readonly handleSave: () => void;
  readonly summary: string;
}

function useDraftForm(
  initial: Readonly<VersionDetail>,
  outcomes: Readonly<{
    onPublished: (version: string) => Promise<void>;
    onSaved: () => void;
  }>,
): DraftForm {
  const [body, setBody] = useState(initial.body);
  const [summary, setSummary] = useState(initial.summary ?? "");
  const action = useAction();
  return {
    blocked: action.blocked || body.trim() === "",
    body,
    error: action.error,
    handleBodyChange: setBody,
    handleSummaryChange: setSummary,
    handlePublish: (): void => {
      action.run(async () => {
        await reviseDraft({ body, id: initial.id, summary });
        const published = await publishVersion(initial.id);
        await outcomes.onPublished(published.version);
      });
    },
    handleSave: (): void => {
      action.run(async () => {
        await reviseDraft({ body, id: initial.id, summary });
        outcomes.onSaved();
      });
    },
    summary,
  };
}

export { useDraftForm };
