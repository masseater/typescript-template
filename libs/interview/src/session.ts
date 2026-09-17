import { Clock, Effect, Option, Schema } from "effect";
import type { InterviewState, MemberUtterance } from "./state.ts";
import { accepts, advance, begin, needsModel, save, spoken } from "./engine.ts";
import {
  countInterviewTurn,
  findInterview,
  startInterview,
  storeInterview,
} from "@template/db/interview";
import { Interviewer } from "./interviewer.ts";
import { State } from "./state.ts";
import { TurnRejected } from "./turn-rejected.ts";
import type { Understanding } from "./understanding.ts";
import type { UnderstandingFailed } from "./understanding-failed.ts";
import { fieldKeys } from "./sheet.ts";
import { viewOf } from "./contracts.ts";

const dailyTurns = 60;
const dayLength = 10;

const decodeState = Schema.decodeUnknownOption(State);
const encodeState = Schema.encodeEffect(State);

const moment = Effect.map(Clock.currentTimeMillis, (millis) => {
  const now = new Date(millis);
  return { day: now.toISOString().slice(0, dayLength), now };
});

const replace = Effect.fn("interview.replace")(function* replace(
  userId: string,
  version: number,
  content: { readonly savedSheet: unknown; readonly state: InterviewState },
) {
  const state = yield* Effect.orDie(encodeState(content.state));
  const { now } = yield* moment;
  yield* storeInterview(userId, { now, savedSheet: content.savedSheet, state, version });
  return viewOf(content.state);
});

const current = Effect.fn("interview.current")(function* current(userId: string) {
  const record = yield* findInterview(userId);
  const state = record === null ? Option.none() : decodeState(record.state);
  if (record !== null && Option.isSome(state)) {
    return { savedSheet: record.savedSheet, state: state.value, version: record.version };
  }
  const fresh = begin();
  if (record === null) {
    yield* startInterview(userId, yield* Effect.orDie(encodeState(fresh)), yield* moment);
    return { savedSheet: undefined, state: fresh, version: 0 };
  }
  // oxlint-disable-next-line unicorn/no-null
  yield* replace(userId, record.version, { savedSheet: null, state: fresh });
  return { savedSheet: undefined, state: fresh, version: record.version + 1 };
});

interface Reading {
  readonly source: "model" | "rules" | UnderstandingFailed["reason"];
  readonly understanding?: Understanding;
}

function understood(
  state: InterviewState,
  utterance: MemberUtterance,
): Effect.Effect<Reading, never, Interviewer> {
  if (!needsModel(utterance)) {
    return Effect.succeed({ source: "rules" });
  }
  return Effect.gen(function* understand() {
    const interviewer = yield* Interviewer;
    return yield* interviewer.understand(state, spoken(utterance)).pipe(
      Effect.map((understanding): Reading => ({ source: "model", understanding })),
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      Effect.catchTag("UnderstandingFailed", (failure) =>
        Effect.succeed<Reading>({ source: failure.reason }),
      ),
    );
  });
}

const openInterview = Effect.fn("interview.open")(function* openInterview(userId: string) {
  const { state } = yield* current(userId);
  return viewOf(state);
});

const takeTurn = Effect.fn("interview.turn")(function* takeTurn(
  userId: string,
  utterance: MemberUtterance,
) {
  const { savedSheet, state, version } = yield* current(userId);
  if (!accepts(state, utterance)) {
    return yield* new TurnRejected();
  }
  yield* countInterviewTurn(userId, (yield* moment).day, dailyTurns);
  const { source, understanding } = yield* understood(state, utterance);
  const next = advance(state, utterance, understanding);
  const view = yield* replace(userId, version, { savedSheet, state: next });
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
