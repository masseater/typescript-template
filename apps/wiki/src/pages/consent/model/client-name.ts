import { Atom } from "effect/unstable/reactivity";
import type { RequestResult } from "@template/ui";
import { loadClientName } from "#pages/consent/api/consent.ts";
import { requestAtom } from "@template/ui";
import { useAtomValue } from "@effect/atom-react";

const clientNameAtom = Atom.family((clientId: string) =>
  requestAtom(async () => loadClientName(clientId)),
);

function useClientName(clientId: string): RequestResult<string | undefined> {
  return useAtomValue(clientNameAtom(clientId));
}

export { useClientName };
