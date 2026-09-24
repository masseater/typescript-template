import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import {
  type ActionState,
  type RequestResult,
  localState,
  requestAtom,
  resultError,
  useAction,
} from "@repo/ui";
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

function firstError(actions: readonly ActionState[]): string | undefined {
  return actions.find((action) => action.error !== undefined)?.error;
}

function heardTurn(failedTurn: MemberUtterance | undefined): string | undefined {
  return failedTurn === undefined ? undefined : spoken(failedTurn);
}

function loadedView(loaded: RequestResult<InterviewViewData>): InterviewViewData | undefined {
  return AsyncResult.isSuccess(loaded) ? loaded.value : undefined;
}

function settle(
  publish: (next: InterviewViewData) => void,
  onSaved: (() => Promise<void>) | undefined,
): (next: InterviewViewData) => Promise<void> | undefined {
  return (next) => {
    publish(next);
    return next.phase === "saved" ? onSaved?.() : undefined;
  };
}

function useInterview(onSaved?: () => Promise<void>): InterviewSession {
  const loaded = useAtomValue(interviewAtom);
  const refresh = useAtomRefresh(interviewAtom);
  const [view, setView] = useView();
  const [failedTurn, setFailedTurn] = useFailedTurn();
  const turnAction = useAction();
  const saveAction = useAction();
  const restartAction = useAction();
  const consentAction = useAction();
  const actions = [turnAction, saveAction, restartAction, consentAction];
  const publish = (next: InterviewViewData): void => {
    setFailedTurn(undefined);
    setView(next);
  };
  const afterSave = settle(publish, onSaved);
  const say = (utterance: MemberUtterance): void => {
    setFailedTurn(utterance);
    turnAction.run(() => submitTurn(utterance).then(publish));
  };
  return {
    busy: actions.some((action) => action.pending),
    consent: (accept: boolean) => {
      consentAction.run(() => respondHistoryConsent(accept).then(afterSave));
    },
    failure: firstError(actions),
    heard: heardTurn(failedTurn),
    loadError: resultError(loaded),
    pending: loaded.waiting,
    reload: () => {
      setView(undefined);
      refresh();
    },
    restart: () => {
      restartAction.run(() => restartInterviewSession().then(publish));
    },
    retry: () => {
      if (failedTurn !== undefined) {
        say(failedTurn);
      }
    },
    save: () => {
      saveAction.run(() => saveInterviewSheet().then(afterSave));
    },
    say,
    turnFailed: turnAction.error !== undefined,
    typing: turnAction.pending,
    view: view ?? loadedView(loaded),
  };
}

export { useInterview };
export type { InterviewSession };
