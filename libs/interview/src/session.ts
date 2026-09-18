import { Effect, Option, Schema } from "effect";
import type { InterviewState, MemberUtterance } from "./state.ts";
import { accepts, advance, begin, needsModel, save, spoken } from "./engine.ts";
import {
  countInterviewTurn,
  findInterview,
  startInterview,
  storeInterview,
} from "@repo/db/interview";
import { Interviewer } from "./interviewer.ts";
import { State } from "./state.ts";
import { TurnRejected } from "./turn-rejected.ts";
import type { UnderstandingData } from "./understanding.ts";
import type { UnderstandingFailed } from "./understanding-failed.ts";
import { fieldKeys } from "./sheet.ts";
import { viewOf } from "./contracts.ts";

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
  yield* storeInterview(userId, version, { ...content, state });
  return viewOf(content.state);
});

const discard = Effect.fn("interview.discard")(function* discard(userId: string, version: number) {
  const state = begin();
  yield* Effect.logWarning("interview.state_discarded", { version });
  yield* replace(userId, version, { state });
  return { state, version: version + 1 };
});

const current = Effect.fn("interview.current")(function* current(userId: string) {
  const record = yield* findInterview(userId);
  if (record === null) {
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("UnderstandingFailed", (failure) =>
      Effect.as(
        Effect.logWarning("interview.model_failed", {
          cause: failure.cause,
          reason: failure.reason,
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
  yield* Effect.logInfo("interview.turn", {
    answered: fieldKeys.filter((key) => next.sheet[key] !== undefined).length,
    phase: next.phase,
    question: next.messages.at(-1)?.text === understanding?.message ? "model" : "scripted",
    source,
    utterance: utterance.kind,
  });
  return view;
});

const saveInterview = Effect.fn("interview.save")(function* saveInterview(userId: string) {
  const { state, version } = yield* current(userId);
  if (state.phase !== "summary") {
    return yield* new TurnRejected();
  }
  return yield* replace(userId, version, { savedSheet: state.sheet, state: save(state) });
});

const restartInterview = Effect.fn("interview.restart")(function* restartInterview(userId: string) {
  const { version } = yield* current(userId);
  // oxlint-disable-next-line unicorn/no-null
  return yield* replace(userId, version, { savedSheet: null, state: begin() });
});

export { openInterview, restartInterview, saveInterview, takeTurn };
