import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { loadClientName } from "#pages/consent/api/consent.ts";

const clientNameAtom = Atom.family((clientId: string) =>
  requestAtom(async () => loadClientName(clientId)),
);

function useClientName(clientId: string): RequestResult<string | undefined> {
  return useAtomValue(clientNameAtom(clientId));
}

export { useClientName };
