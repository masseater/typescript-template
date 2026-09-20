import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { useEffect, useState } from "react";

import { adminClient } from "#shared/api/index.ts";
import { AgreementVersionDetail, AgreementVersionList } from "#shared/contracts/index.ts";

type VersionList = typeof AgreementVersionList.Type;
type VersionDetail = typeof AgreementVersionDetail.Type;

type Loaded<Value> =
  | Readonly<{ status: "failed"; message: string }>
  | Readonly<{ status: "loaded"; value: Value }>
  | Readonly<{ status: "loading" }>;

async function fetchVersions(): Promise<Loaded<VersionList>> {
  try {
    return {
      status: "loaded",
      value: apiData(AgreementVersionList, await adminClient().agreements.get()),
    };
  } catch (error) {
    return { message: errorMessage(error), status: "failed" };
  }
}

async function fetchVersion(version: string): Promise<Loaded<VersionDetail>> {
  try {
    return {
      status: "loaded",
      value: apiData(
        AgreementVersionDetail,
        await adminClient().agreements.version.get({ query: { version } }),
      ),
    };
  } catch (error) {
    return { message: errorMessage(error), status: "failed" };
  }
}

interface Outcome<Value> {
  readonly attempt: number;
  readonly key: string;
  readonly state: Loaded<Value>;
}

function useLoaded<Value>(
  key: string,
  load: (key: string) => Promise<Loaded<Value>>,
): Readonly<{ reload: () => void; state: Loaded<Value> }> {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome<Value>>();
  useEffect(() => {
    const controller = { active: true };
    async function run(): Promise<void> {
      const state = await load(key);
      if (controller.active) {
        setOutcome({ attempt, key, state });
      }
    }
    void run();
    return (): void => {
      controller.active = false;
    };
  }, [attempt, key, load]);
  const current = outcome?.key === key && outcome.attempt === attempt;
  return {
    reload: (): void => {
      setAttempt((count) => count + 1);
    },
    state: current ? outcome.state : { status: "loading" },
  };
}

function useAgreementVersions(): Readonly<{ reload: () => void; state: Loaded<VersionList> }> {
  return useLoaded("list", fetchVersions);
}

function useAgreementVersion(
  version: string,
): Readonly<{ reload: () => void; state: Loaded<VersionDetail> }> {
  return useLoaded(version, fetchVersion);
}

export { useAgreementVersion, useAgreementVersions };
export type { Loaded, VersionDetail, VersionList };
