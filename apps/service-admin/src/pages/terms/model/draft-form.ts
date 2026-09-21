import { useAtom } from "@effect/atom-react";
import { useAction } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { publishVersion, reviseDraft } from "#pages/terms/api/agreement-versions.ts";

import type { VersionDetail } from "#pages/terms/model/agreement-versions.ts";

interface DraftFields {
  readonly body: string;
  readonly summary: string;
}

interface DraftForm extends DraftFields {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleSummaryChange: (value: string) => void;
  readonly handlePublish: () => void;
  readonly handleSave: () => void;
}

const draftAtom = Atom.family((initial: Readonly<VersionDetail>) =>
  Atom.make<DraftFields>({ body: initial.body, summary: initial.summary ?? "" }),
);

function useDraftForm(
  initial: Readonly<VersionDetail>,
  outcomes: Readonly<{
    onPublished: (version: string) => Promise<void>;
    onSaved: () => void;
  }>,
): DraftForm {
  const [fields, setFields] = useAtom(draftAtom(initial));
  const action = useAction();
  return {
    ...fields,
    blocked: action.blocked || fields.body.trim() === "",
    error: action.error,
    handleBodyChange: (body): void => {
      setFields((current) => ({ ...current, body }));
    },
    handleSummaryChange: (summary): void => {
      setFields((current) => ({ ...current, summary }));
    },
    handlePublish: (): void => {
      action.run(async () => {
        await reviseDraft({ ...fields, id: initial.id });
        const published = await publishVersion(initial.id);
        await outcomes.onPublished(published.version);
      });
    },
    handleSave: (): void => {
      action.run(async () => {
        await reviseDraft({ ...fields, id: initial.id });
        outcomes.onSaved();
      });
    },
  };
}

export { useDraftForm };
