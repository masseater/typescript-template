import { assert, it } from "@effect/vitest";
import { AGREEMENT_KIND } from "@repo/config";
import {
  acceptedAgreements,
  findInterview,
  hasAcceptedLatestAgreement,
  withdrawAgreementKind,
} from "@repo/db";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { Effect, Layer, Schema } from "effect";

import { ProfileLayoutAssembler } from "#shared/profile-layout/assembler.ts";
import { readSavedSheet } from "#shared/profile-layout/saved-sheet.ts";
import { Interviewer } from "./interviewer.ts";
import {
  openInterview,
  respondHistoryConsent,
  saveInterview,
  takeTurn,
  withdrawInterviewHistoryConsent,
} from "./session.ts";
import { State } from "./state.ts";

const withoutModel = Layer.mergeAll(
  TestDatabase,
  Interviewer.layer(),
  ProfileLayoutAssembler.layer(),
);

function addMember(id: string): Effect.Effect<unknown, unknown> {
  return runStatement(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
    id,
    id,
    `${id}@example.com`,
  );
}

const finishInterview = Effect.fn("finishInterview")(function* finishInterview(userId: string) {
  yield* takeTurn(userId, { kind: "text", text: "たろう" });
  yield* takeTurn(userId, { kind: "finish" });
  return yield* saveInterview(userId);
});

const messageCount = (state: unknown): Effect.Effect<number> =>
  Schema.decodeUnknownEffect(State)(state).pipe(
    Effect.map((decoded) => decoded.messages.length),
    Effect.orDie,
  );

it.effect("declining history consent removes conversation while keeping the saved sheet", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    const saved = yield* finishInterview("member");
    assert.strictEqual(saved.phase, "history_consent");
    const beforeDecline = yield* findInterview("member");
    assert.isAbove(yield* messageCount(beforeDecline?.state), 1);
    const declined = yield* respondHistoryConsent("member", false);
    assert.strictEqual(declined.phase, "saved");
    const stored = yield* findInterview("member");
    assert.deepStrictEqual(readSavedSheet(stored?.savedSheet).sheet, { nickname: "たろう" });
    assert.strictEqual(yield* messageCount(stored?.state), 1);
    assert.isFalse(yield* hasAcceptedLatestAgreement("member", AGREEMENT_KIND.interview_history));
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("accepting history consent keeps conversation and records agreement acceptance", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    const saved = yield* finishInterview("member");
    assert.strictEqual(saved.phase, "history_consent");
    const beforeAccept = yield* findInterview("member");
    const messagesBefore = yield* messageCount(beforeAccept?.state);
    const accepted = yield* respondHistoryConsent("member", true);
    assert.strictEqual(accepted.phase, "saved");
    assert.isAbove(accepted.messages.length, 1);
    const stored = yield* findInterview("member");
    assert.strictEqual(yield* messageCount(stored?.state), messagesBefore + 1);
    assert.deepStrictEqual(readSavedSheet(stored?.savedSheet).sheet, { nickname: "たろう" });
    assert.isTrue(yield* hasAcceptedLatestAgreement("member", AGREEMENT_KIND.interview_history));
    const history = yield* acceptedAgreements("member");
    assert.deepStrictEqual(
      history.filter((agreement) => agreement.kind === AGREEMENT_KIND.interview_history).length,
      1,
    );
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("withdrawing consent deletes stored conversation history", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* finishInterview("member");
    yield* respondHistoryConsent("member", true);
    const beforeWithdraw = yield* findInterview("member");
    assert.isAbove(yield* messageCount(beforeWithdraw?.state), 1);
    yield* withdrawAgreementKind({
      kind: AGREEMENT_KIND.interview_history,
      userId: "member",
    });
    yield* withdrawInterviewHistoryConsent("member");
    const stored = yield* findInterview("member");
    assert.strictEqual(yield* messageCount(stored?.state), 1);
    assert.deepStrictEqual(readSavedSheet(stored?.savedSheet).sheet, { nickname: "たろう" });
    assert.isFalse(yield* hasAcceptedLatestAgreement("member", AGREEMENT_KIND.interview_history));
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("reopening after decline does not restore removed conversation", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* finishInterview("member");
    yield* respondHistoryConsent("member", false);
    const reopened = yield* openInterview("member");
    assert.strictEqual(reopened.phase, "saved");
    assert.strictEqual(reopened.messages.length, 1);
  }).pipe(Effect.provide(withoutModel)),
);
