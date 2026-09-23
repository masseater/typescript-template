import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";

import { loadClientName } from "#pages/consent/api/consent.ts";

const clientNameAtom = Atom.family((clientId: string) =>
  requestAtom(() => Effect.runPromise(loadClientName(clientId))),
);

function useClientName(clientId: string): RequestResult<string | undefined> {
  return useAtomValue(clientNameAtom(clientId));
}

export { useClientName };
