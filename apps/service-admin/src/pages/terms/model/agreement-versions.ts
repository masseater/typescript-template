import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { requestAtom, type RequestResult } from "@repo/ui";
import { Atom } from "effect/unstable/reactivity";

import { adminClient } from "#shared/api/index.ts";
import { AgreementVersionDetail, AgreementVersionList } from "#shared/contracts/index.ts";

type VersionList = typeof AgreementVersionList.Type;
type VersionDetail = typeof AgreementVersionDetail.Type;

interface Loaded<Value> {
  readonly reload: () => void;
  readonly state: RequestResult<Value>;
}

async function fetchVersions(): Promise<VersionList> {
  try {
    return apiData(AgreementVersionList, await adminClient().agreements.get());
  } catch (failure) {
    throw new Error(errorMessage(failure));
  }
}

async function fetchVersion(version: string): Promise<VersionDetail> {
  try {
    return apiData(
      AgreementVersionDetail,
      await adminClient().agreements.version.get({ query: { version } }),
    );
  } catch (failure) {
    throw new Error(errorMessage(failure));
  }
}

const versionListAtom = requestAtom(fetchVersions);

const versionDetailAtom = Atom.family((version: string) =>
  requestAtom(async () => fetchVersion(version)),
);

function useAgreementVersions(): Loaded<VersionList> {
  return { reload: useAtomRefresh(versionListAtom), state: useAtomValue(versionListAtom) };
}

function useAgreementVersion(version: string): Loaded<VersionDetail> {
  const atom = versionDetailAtom(version);
  return { reload: useAtomRefresh(atom), state: useAtomValue(atom) };
}

export { useAgreementVersion, useAgreementVersions };
export type { VersionDetail, VersionList };
