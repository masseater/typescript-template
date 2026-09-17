import { Effect, Layer } from "effect";
import { TestDatabase, runStatement } from "@template/db/testing";
import { assert, it } from "@effect/vitest";
import { openInterview, restartInterview, saveInterview, takeTurn } from "./session.ts";
import { Interviewer } from "./interviewer.ts";
import { TestClock } from "effect/testing";
import { UnderstandingFailed } from "./understanding-failed.ts";
import { findInterview } from "@template/db/interview";

type Understand = Parameters<typeof Interviewer.of>[0]["understand"];

const DAILY_TURNS = 60;
const NICKNAME_LIMIT = 30;
const greeting = { role: "interviewer", text: "はじめまして。なんて呼べばいいですか？" } as const;

function addMember(id: string): Effect.Effect<unknown, unknown> {
  return runStatement(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)",
    id,
    id,
    `${id}@example.com`,
  );
}

function services(
  understand: Understand,
): Layer.Layer<Layer.Success<typeof TestDatabase> | Interviewer, Layer.Error<typeof TestDatabase>> {
  return Layer.merge(TestDatabase, Layer.succeed(Interviewer, Interviewer.of({ understand })));
}

const withoutModel = Layer.merge(TestDatabase, Interviewer.layer());

it.effect("an interview that was left midway resumes with the same conversation", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    const opened = yield* openInterview("member");
    assert.deepStrictEqual(opened.messages, [greeting]);
    const answered = yield* takeTurn("member", { kind: "text", text: "たろう" });
    assert.deepStrictEqual(yield* openInterview("member"), answered);
    assert.deepStrictEqual(answered.fields[0], {
      key: "nickname",
      label: "呼び名",
      status: "answered",
      value: "たろう",
    });
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("what the model understood is applied to the sheet", () => {
  const message = "大阪の学生さんなんですね。なんて呼べばいいですか？";
  function understand(): ReturnType<Understand> {
    return Effect.succeed({
      ask: "nickname",
      finish: false,
      message,
      skip: false,
      values: { area: "大阪", occupation: "学生" },
    });
  }
  return Effect.gen(function* program() {
    yield* addMember("member");
    const view = yield* takeTurn("member", { kind: "text", text: "大阪で学生をしています" });
    assert.deepStrictEqual(
      view.fields.map(({ key, status }) => ({ key, status })),
      [
        { key: "nickname", status: "unanswered" },
        { key: "occupation", status: "answered" },
        { key: "interests", status: "unanswered" },
        { key: "area", status: "answered" },
        { key: "message", status: "unanswered" },
      ],
    );
    assert.deepStrictEqual(view.messages.at(-1), { role: "interviewer", text: message });
  }).pipe(Effect.provide(services(understand)));
});

it.effect("a failing model is hidden from the member and the scripted interview continues", () => {
  const failure = new UnderstandingFailed({ reason: "model_failed" });
  function understand(): ReturnType<Understand> {
    return Effect.fail(failure);
  }
  return Effect.gen(function* program() {
    yield* addMember("member");
    const view = yield* takeTurn("member", { kind: "text", text: "たろう" });
    assert.deepStrictEqual(view.messages.at(-1), {
      role: "interviewer",
      text: "ありがとうございます。ふだんはどんなお仕事をしていますか？",
    });
  }).pipe(Effect.provide(services(understand)));
});

it.effect("saving keeps the sheet and is refused while questions remain", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* takeTurn("member", { kind: "text", text: "たろう" });
    const early = yield* saveInterview("member").pipe(Effect.flip);
    assert.strictEqual(early._tag, "TurnRejected");
    yield* takeTurn("member", { kind: "finish" });
    const saved = yield* saveInterview("member");
    assert.strictEqual(saved.phase, "saved");
    assert.deepStrictEqual((yield* findInterview("member"))?.savedSheet, { nickname: "たろう" });
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("restarting discards the conversation and the saved sheet", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* takeTurn("member", { kind: "text", text: "たろう" });
    yield* takeTurn("member", { kind: "finish" });
    yield* saveInterview("member");
    const restarted = yield* restartInterview("member");
    assert.deepStrictEqual(restarted.messages, [greeting]);
    assert.strictEqual(restarted.phase, "asking");
    assert.isNull((yield* findInterview("member"))?.savedSheet);
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("a correction after saving keeps the saved sheet until it is saved again", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* takeTurn("member", { kind: "text", text: "たろう" });
    yield* takeTurn("member", { kind: "finish" });
    yield* saveInterview("member");
    const corrected = yield* takeTurn("member", { kind: "text", text: "呼び名はジロウ" });
    assert.strictEqual(corrected.phase, "summary");
    assert.deepStrictEqual((yield* findInterview("member"))?.savedSheet, { nickname: "たろう" });
    yield* saveInterview("member");
    assert.deepStrictEqual((yield* findInterview("member"))?.savedSheet, { nickname: "ジロウ" });
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("a stored conversation that no longer matches the schema starts over", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* takeTurn("member", { kind: "text", text: "たろう" });
    yield* takeTurn("member", { kind: "finish" });
    yield* saveInterview("member");
    const outdated = '{"phase":"old"}';
    yield* runStatement("UPDATE interview SET state = ? WHERE user_id = ?", outdated, "member");
    const opened = yield* openInterview("member");
    assert.deepStrictEqual(opened.messages, [greeting]);
    assert.deepStrictEqual((yield* findInterview("member"))?.savedSheet, { nickname: "たろう" });
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("only utterances that need the model count toward the daily limit", () =>
  Effect.gen(function* program() {
    yield* addMember("member");
    yield* Effect.forEach(
      Array.from({ length: DAILY_TURNS }),
      () => takeTurn("member", { kind: "text", text: "あ".repeat(NICKNAME_LIMIT + 1) }),
      { discard: true },
    );
    const refused = yield* takeTurn("member", { kind: "text", text: "たろう" }).pipe(Effect.flip);
    assert.strictEqual(refused._tag, "InterviewLimitReached");
    const finished = yield* takeTurn("member", { kind: "finish" });
    assert.strictEqual(finished.phase, "summary");
    yield* TestClock.adjust("1 day");
    const view = yield* takeTurn("member", { kind: "text", text: "呼び名はたろう" });
    assert.strictEqual(view.fields[0]?.status, "answered");
  }).pipe(Effect.provide(withoutModel)),
);
