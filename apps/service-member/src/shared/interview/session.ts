import { AGREEMENT_KIND } from "@repo/config";
import {
  acceptAgreementVersions,
  countInterviewTurn,
  findInterview,
  hasAcceptedLatestAgreement,
  pendingAgreements,
  startInterview,
  storeInterview,
} from "@repo/db";
import { logAt } from "@repo/observability";
import { Clock, Effect, Option, Schema } from "effect";

import { assembleProfileLayout } from "#shared/profile-layout/assembler.ts";
import { writeSavedSheet } from "#shared/profile-layout/saved-sheet.ts";
import { accepts, clearConversation, needsModel } from "./engine.ts";
import { advance, begin, requestHistoryConsent, save, spoken, viewOf } from "./index.ts";
import { Interviewer } from "./interviewer.ts";
import { fieldKeys } from "./sheet.ts";
import { State } from "./state.ts";
import { TurnRejected } from "./turn-rejected.ts";

import type { InterviewState, MemberUtterance } from "./index.ts";
import type { UnderstandingFailed } from "./understanding-failed.ts";
import type { UnderstandingData } from "./understanding.ts";

const dailyModelTurns = 60;

const decodeState = Schema.decodeUnknownOption(State);
const encodeState = Schema.encodeEffect(State);

interface Reading {
  readonly source: "model" | "rules" | UnderstandingFailed["reason"];
  readonly understanding?: UnderstandingData;
}

const replace = Effect.fn("interview.replace")(function* replace(
  userId: string,
  version: number,
  content: { readonly savedSheet?: unknown; readonly state: InterviewState },
) {
  const state = yield* Effect.orDie(encodeState(content.state));
  yield* storeInterview({ ...content, state, userId, version });
  return viewOf(content.state);
});

const discard = Effect.fn("interview.discard")(function* discard(userId: string, version: number) {
  const state = begin();
  yield* logAt("Warn", { attributes: { version }, eventName: "interview.state_discarded" });
  yield* replace(userId, version, { state });
  return { state, version: version + 1 };
});

const current = Effect.fn("interview.current")(function* current(userId: string) {
  const record = yield* findInterview(userId);
  if (record === undefined) {
    const state = begin();
    yield* startInterview(userId, yield* Effect.orDie(encodeState(state)));
    return { state, version: 0 };
  }
  const { version } = record;
  return yield* Option.match(decodeState(record.state), {
    onNone: () => discard(userId, version),
    onSome: (state) => Effect.succeed({ state, version }),
  });
});

const understood = Effect.fn("interview.understand")(function* understood(
  state: InterviewState,
  utterance: MemberUtterance,
  userId: string,
) {
  if (!needsModel(utterance)) {
    return { source: "rules" } satisfies Reading;
  }
  yield* countInterviewTurn(userId, dailyModelTurns);
  const interviewer = yield* Interviewer;
  return yield* interviewer.understand(state, spoken(utterance)).pipe(
    Effect.map((understanding): Reading => ({ source: "model", understanding })),
    Effect.catchTag("UnderstandingFailed", (failure) =>
      Effect.as(
        logAt("Warn", {
          attributes: {
            ...(failure.cause === undefined ? {} : { cause: String(failure.cause) }),
            reason: failure.reason,
          },
          eventName: "interview.model_failed",
        }),
        { source: failure.reason } satisfies Reading,
      ),
    ),
  );
});

const openInterview = Effect.fn("interview.open")(function* openInterview(userId: string) {
  const { state } = yield* current(userId);
  return viewOf(state);
});

const takeTurn = Effect.fn("interview.turn")(function* takeTurn(
  userId: string,
  utterance: MemberUtterance,
) {
  const { state, version } = yield* current(userId);
  if (!accepts(state, utterance)) {
    return yield* new TurnRejected();
  }
  const { source, understanding }: Reading = yield* understood(state, utterance, userId);
  const next = advance(state, utterance, understanding);
  const view = yield* replace(userId, version, { state: next });
  yield* logAt("Info", {
    attributes: {
      answered: fieldKeys.filter((key) => next.sheet[key] !== undefined).length,
      phase: next.phase,
      question: next.messages.at(-1)?.text === understanding?.message ? "model" : "scripted",
      source,
      utterance: utterance.kind,
    },
    eventName: "interview.turn",
  });
  return view;
});

const finishSaving = Effect.fn("interview.finishSaving")(function* finishSaving(
  userId: string,
  version: number,
  state: Exclude<InterviewState, { readonly phase: "asking" }>,
) {
  const layout = yield* assembleProfileLayout(state.sheet);
  const savedSheet = yield* Effect.orDie(writeSavedSheet(state.sheet, layout));
  const accepted = yield* hasAcceptedLatestAgreement(userId, AGREEMENT_KIND.interview_history);
  const next = accepted ? save(state) : requestHistoryConsent(state);
  return yield* replace(userId, version, { savedSheet, state: next });
});

const saveInterview = Effect.fn("interview.save")(function* saveInterview(userId: string) {
  const { state, version } = yield* current(userId);
  if (state.phase !== "summary") {
    return yield* new TurnRejected();
  }
  return yield* finishSaving(userId, version, state);
});

const respondHistoryConsent = Effect.fn("interview.respondHistoryConsent")(
  function* respondHistoryConsent(userId: string, accept: boolean) {
    const { state, version } = yield* current(userId);
    if (state.phase !== "history_consent") {
      return yield* new TurnRejected();
    }
    if (accept) {
      const [pending] = (yield* pendingAgreements(userId)).filter(
        (agreement) => agreement.kind === AGREEMENT_KIND.interview_history,
      );
      if (pending === undefined) {
        return yield* replace(userId, version, { state: save(state) });
      }
      const acceptedAt = yield* Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));
      yield* acceptAgreementVersions({
        acceptedAt,
        userId,
        versionIds: [pending.id],
      });
      return yield* replace(userId, version, { state: save(state) });
    }
    return yield* replace(userId, version, { state: clearConversation(state) });
  },
);

const withdrawInterviewHistoryConsent = Effect.fn("interview.withdrawHistoryConsent")(
  function* withdrawInterviewHistoryConsent(userId: string) {
    const { state, version } = yield* current(userId);
    if (state.phase === "history_consent") {
      return yield* replace(userId, version, { state: clearConversation(state) });
    }
    if (state.phase === "saved" && state.messages.length > 1) {
      return yield* replace(userId, version, { state: clearConversation(state) });
    }
    return viewOf(state);
  },
);

const restartInterview = Effect.fn("interview.restart")(function* restartInterview(userId: string) {
  const { version } = yield* current(userId);
  // oxlint-disable-next-line unicorn/no-null -- restart clears the saved sheet by writing SQL null into the nullable savedSheet column
  return yield* replace(userId, version, { savedSheet: null, state: begin() });
});

export {
  openInterview,
  respondHistoryConsent,
  restartInterview,
  saveInterview,
  takeTurn,
  withdrawInterviewHistoryConsent,
};
