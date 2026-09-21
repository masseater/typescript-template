import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { findInterview } from "@repo/db";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { HttpResponse, http } from "msw";

import { ProfileLayoutAssembler } from "#shared/profile-layout/assembler.ts";
import { readSavedSheet } from "#shared/profile-layout/saved-sheet.ts";
import { Interviewer } from "./interviewer.ts";
import { openInterview, restartInterview, saveInterview, takeTurn } from "./session.ts";
import { UnderstandingFailed } from "./understanding-failed.ts";

type Understand = Parameters<typeof Interviewer.of>[0]["understand"];

const DAILY_TURNS = 60;
const NICKNAME_LIMIT = 30;
const greeting = { role: "interviewer", text: "はじめまして。なんて呼べばいいですか？" } as const;
const layoutEndpoint =
  "https://api.cloudflare.com/client/v4/accounts/account/ai/v1/chat/completions";
const layoutAccess = { accountId: "account", apiKey: "test-token" } as const;

function layoutCompletion(content: unknown): Response {
  return HttpResponse.json({
    choices: [
      {
        finish_reason: "stop",
        index: 0,
        message: { content: JSON.stringify(content), role: "assistant" },
      },
    ],
    created: 0,
    id: "completion",
    model: "@cf/google/gemma-4-26b-a4b-it",
    object: "chat.completion",
  });
}

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
): Layer.Layer<
  Layer.Success<typeof TestDatabase> | Interviewer | ProfileLayoutAssembler,
  Layer.Error<typeof TestDatabase>
> {
  return Layer.mergeAll(
    TestDatabase,
    Layer.succeed(Interviewer, Interviewer.of({ understand })),
    ProfileLayoutAssembler.layer(),
  );
}

const withoutModel = Layer.mergeAll(
  TestDatabase,
  Interviewer.layer(),
  ProfileLayoutAssembler.layer(),
);

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
    assert.deepStrictEqual(readSavedSheet((yield* findInterview("member"))?.savedSheet).sheet, {
      nickname: "たろう",
    });
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
    assert.deepStrictEqual(readSavedSheet((yield* findInterview("member"))?.savedSheet).sheet, {
      nickname: "たろう",
    });
    yield* saveInterview("member");
    assert.deepStrictEqual(readSavedSheet((yield* findInterview("member"))?.savedSheet).sheet, {
      nickname: "ジロウ",
    });
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
    assert.deepStrictEqual(readSavedSheet((yield* findInterview("member"))?.savedSheet).sheet, {
      nickname: "たろう",
    });
  }).pipe(Effect.provide(withoutModel)),
);

it.effect("saving stores a model-assembled layout with the sheet", () =>
  Effect.gen(function* program() {
    const network = setupNetwork();
    network.configure({ onUnhandledFrame: "error" });
    network.use(
      http.post(layoutEndpoint, () =>
        layoutCompletion({
          blocks: [{ kind: "identity" }, { kind: "sheet-nickname" }, { kind: "actions" }],
        }),
      ),
    );
    network.enable();
    yield* addMember("member");
    yield* takeTurn("member", { kind: "text", text: "たろう" });
    yield* takeTurn("member", { kind: "finish" });
    yield* saveInterview("member");
    const saved = readSavedSheet((yield* findInterview("member"))?.savedSheet);
    assert.deepStrictEqual(
      saved.layout?.blocks.map((block) => block.kind),
      ["identity", "sheet-nickname", "actions"],
    );
    network.disable();
  }).pipe(
    Effect.provide(
      Layer.mergeAll(TestDatabase, Interviewer.layer(), ProfileLayoutAssembler.layer(layoutAccess)),
    ),
  ),
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
