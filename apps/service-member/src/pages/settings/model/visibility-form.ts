import { useAtom } from "@effect/atom-react";
import { profileVisibilities } from "@repo/config";
import { useAction } from "@repo/ui";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { saveVisibility } from "#pages/settings/api/visibility.ts";

import type { Visibility } from "#pages/settings/api/visibility.ts";

interface VisibilityForm extends Visibility {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleSearchableChange: (checked: boolean) => void;
  readonly handleSubmit: (event: Readonly<{ preventDefault: () => void }>) => void;
  readonly handleVisibilityChange: (value: string) => void;
  readonly pending: boolean;
}

const isVisibility = Schema.is(Schema.Literals(profileVisibilities));

const fieldsAtom = Atom.family((initial: Visibility) =>
  Atom.make<Visibility>({ searchable: initial.searchable, visibility: initial.visibility }),
);

function useVisibilityForm(initial: Visibility, onSaved: () => Promise<void>): VisibilityForm {
  const [fields, setFields] = useAtom(fieldsAtom(initial));
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(async () => {
      await saveVisibility(fields);
      await onSaved();
    });
  }
  return {
    ...fields,
    blocked: action.blocked,
    error: action.error,
    handleSearchableChange: (searchable) => {
      setFields((current) => ({ ...current, searchable }));
    },
    handleSubmit,
    handleVisibilityChange: (value) => {
      if (isVisibility(value)) {
        setFields((current) => ({ ...current, visibility: value }));
      }
    },
    pending: action.pending,
  };
}

export { useVisibilityForm };
