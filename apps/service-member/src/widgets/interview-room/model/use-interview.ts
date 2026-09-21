import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { localState, requestAtom, resultError, useAction } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { spoken } from "#shared/interview/index.ts";
import {
  loadInterview,
  respondHistoryConsent,
  restartInterviewSession,
  saveInterviewSheet,
  submitTurn,
} from "../api/interview.ts";

import type { InterviewViewData, MemberUtterance } from "../api/interview.ts";

interface InterviewSession {
  readonly busy: boolean;
  readonly consent: (accept: boolean) => void;
  readonly failure: string | undefined;
  readonly heard: string | undefined;
  readonly loadError: string | undefined;
  readonly pending: boolean;
  readonly reload: () => void;
  readonly restart: () => void;
  readonly retry: () => void;
  readonly save: () => void;
  readonly say: (utterance: MemberUtterance) => void;
  readonly turnFailed: boolean;
  readonly typing: boolean;
  readonly view: InterviewViewData | undefined;
}

const interviewAtom = requestAtom(loadInterview);
const useView = localState<InterviewViewData | undefined>(undefined);
const useFailedTurn = localState<MemberUtterance | undefined>(undefined);

function useInterview(onSaved?: () => Promise<void>): InterviewSession {
  const loaded = useAtomValue(interviewAtom);
  const refresh = useAtomRefresh(interviewAtom);
  const [view, setView] = useView();
  const [failedTurn, setFailedTurn] = useFailedTurn();
  const turnAction = useAction();
  const saveAction = useAction();
  const restartAction = useAction();
  const consentAction = useAction();
  const publish = (next: InterviewViewData): void => {
    setFailedTurn(undefined);
    setView(next);
  };
  const say = (utterance: MemberUtterance): void => {
    setFailedTurn(utterance);
    turnAction.run(async () => {
      publish(await submitTurn(utterance));
    });
  };
  return {
    busy:
      turnAction.pending || saveAction.pending || restartAction.pending || consentAction.pending,
    consent: (accept: boolean) => {
      consentAction.run(async () => {
        const next = await respondHistoryConsent(accept);
        publish(next);
        if (next.phase === "saved" && onSaved !== undefined) {
          await onSaved();
        }
      });
    },
    failure: turnAction.error ?? saveAction.error ?? restartAction.error ?? consentAction.error,
    heard: failedTurn === undefined ? undefined : spoken(failedTurn),
    loadError: resultError(loaded),
    pending: loaded.waiting,
    reload: () => {
      setView(undefined);
      refresh();
    },
    restart: () => {
      restartAction.run(async () => {
        publish(await restartInterviewSession());
      });
    },
    retry: () => {
      if (failedTurn !== undefined) {
        say(failedTurn);
      }
    },
    save: () => {
      saveAction.run(async () => {
        const next = await saveInterviewSheet();
        publish(next);
        if (next.phase === "saved" && onSaved !== undefined) {
          await onSaved();
        }
      });
    },
    say,
    turnFailed: turnAction.error !== undefined,
    typing: turnAction.pending,
    view: view ?? (AsyncResult.isSuccess(loaded) ? loaded.value : undefined),
  };
}

export { useInterview };
