import { useAction } from "@repo/ui";
import { Effect } from "effect";

import { removePerson } from "#pages/recordings/api/recordings.ts";

import type { PeopleActions } from "./recording-state.ts";

function forget(personId: string, onChanged: () => Promise<void>): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* forgetPerson() {
      yield* Effect.promise(() => removePerson(personId));
      yield* Effect.promise(() => onChanged());
    }),
  );
}

function usePeopleActions(onChanged: () => Promise<void>): PeopleActions {
  const action = useAction();
  return {
    blocked: action.blocked,
    error: action.error,
    handleRemove: (personId) => {
      action.run(() => forget(personId, onChanged));
    },
  };
}

export { usePeopleActions };
