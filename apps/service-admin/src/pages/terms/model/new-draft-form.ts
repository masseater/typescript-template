import { AGREEMENT_KIND, agreementKinds, type AgreementKind } from "@repo/config";
import { localState, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { createDraft } from "#pages/terms/api/agreement-versions.ts";

interface NewDraftFields {
  readonly body: string;
  readonly kind: AgreementKind;
  readonly summary: string;
  readonly version: string;
}

interface NewDraftForm extends NewDraftFields {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleBodyChange: (value: string) => void;
  readonly handleKindChange: (value: string) => void;
  readonly handleSave: () => void;
  readonly handleSummaryChange: (value: string) => void;
  readonly handleVersionChange: (value: string) => void;
}

const isKind = (value: string): value is AgreementKind =>
  agreementKinds.some((kind) => kind === value);

const useFields = localState<NewDraftFields>({
  body: "",
  kind: AGREEMENT_KIND.terms,
  summary: "",
  version: "",
});

function useNewDraftForm(): NewDraftForm {
  const navigate = useNavigate();
  const action = useAction();
  const [fields, setFields] = useFields();
  return {
    ...fields,
    blocked: action.blocked || fields.version.trim() === "" || fields.body.trim() === "",
    error: action.error,
    handleBodyChange: (body): void => {
      setFields((current) => ({ ...current, body }));
    },
    handleKindChange: (value): void => {
      if (isKind(value)) {
        setFields((current) => ({ ...current, kind: value }));
      }
    },
    handleSave: (): void => {
      action.run(() =>
        createDraft(fields).then((saved) =>
          navigate({ params: { version: saved.version }, to: "/terms/$version" }),
        ),
      );
    },
    handleSummaryChange: (summary): void => {
      setFields((current) => ({ ...current, summary }));
    },
    handleVersionChange: (version): void => {
      setFields((current) => ({ ...current, version }));
    },
  };
}

export { useNewDraftForm };
