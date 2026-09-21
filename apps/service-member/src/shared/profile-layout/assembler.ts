import { createWorkersAiChat } from "@cloudflare/tanstack-ai/adapters/workers-ai";
import { readAi } from "@repo/config";
import { withSpan } from "@repo/observability";
import { chat } from "@tanstack/ai";
import { Context, Effect, Layer, Option, Schema } from "effect";

import { displayValue, fieldDefinitions, fieldKeys } from "#shared/interview/sheet.ts";
import { interviewProfileLayout } from "./default.ts";
import { LayoutFailed } from "./layout-failed.ts";
import { profileBlock, ProfileLayout } from "./schema.ts";

import type { SheetData } from "#shared/interview/sheet.ts";
import type { ConfigurationInvalid } from "@repo/config";
import type { ProfileLayoutData } from "./schema.ts";

type ModelAccess = Parameters<typeof createWorkersAiChat>[1];

const model = "@cf/google/gemma-4-26b-a4b-it";
const patience = "20 seconds";
const modelOptions = {
  chat_template_kwargs: { enable_thinking: false },
  max_tokens: 300,
  temperature: 0.2,
};

const ModelOutput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(ProfileLayout));

const sheetBlocks = fieldKeys.map((key) => `sheet-${key}（${fieldDefinitions[key].label}）`);
const catalogue = [
  ...sheetBlocks,
  profileBlock.identity,
  profileBlock.biography,
  profileBlock.socialLinks,
  profileBlock.joined,
  profileBlock.actions,
].join("、");
const instructions = [
  "あなたは、会員の自己紹介シートを見て、その人に合うプロフィール画面の並びを選びます。",
  `選べる部品の kind は次だけです: ${catalogue}`,
  "blocks に、使う部品を上から順に並べた配列を返します。同じ kind は 1 回だけ。",
  "identity と actions は必ず含めます。値が無い項目は省いてもよいです。",
  "HTML や自由な文字列は返しません。",
].join("\n");

function request(sheet: SheetData): string {
  const fields = fieldKeys.map((key) => ({
    key,
    label: fieldDefinitions[key].label,
    value: displayValue(sheet, key),
  }));
  return JSON.stringify({ fields });
}

function complete(
  access: ModelAccess,
  sheet: SheetData,
): Effect.Effect<ProfileLayoutData, LayoutFailed> {
  return Effect.tryPromise({
    catch: (cause) => new LayoutFailed({ cause, reason: "model_failed" }),
    try: async () =>
      chat({
        adapter: createWorkersAiChat(model, access),
        messages: [{ content: request(sheet), role: "user" }],
        modelOptions,
        outputSchema: ModelOutput,
        systemPrompts: [instructions],
      }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: patience,
      orElse: () => Effect.fail(new LayoutFailed({ reason: "timed_out" })),
    }),
    withSpan("profile-layout.complete"),
  );
}

interface AssemblerShape {
  readonly assemble: (sheet: SheetData) => Effect.Effect<ProfileLayoutData, LayoutFailed>;
}

class ProfileLayoutAssembler extends Context.Service<ProfileLayoutAssembler, AssemblerShape>()(
  "#shared/profile-layout/ProfileLayoutAssembler",
) {
  public static layer(access?: ModelAccess): Layer.Layer<ProfileLayoutAssembler> {
    return Layer.succeed(
      ProfileLayoutAssembler,
      ProfileLayoutAssembler.of({
        assemble: (sheet) =>
          access === undefined
            ? Effect.fail(new LayoutFailed({ reason: "unavailable" }))
            : complete(access, sheet),
      }),
    );
  }

  public static fromEnvironment(
    env: unknown,
  ): Layer.Layer<ProfileLayoutAssembler, ConfigurationInvalid> {
    return Layer.unwrap(
      Effect.map(readAi(env), (ai) =>
        ProfileLayoutAssembler.layer(ai === undefined ? undefined : { binding: ai }),
      ),
    );
  }
}

const decodeLayout = Schema.decodeUnknownOption(ProfileLayout);

function resolvedLayout(
  sheet: SheetData,
  assembled: ProfileLayoutData | undefined,
): ProfileLayoutData {
  const layout = Option.getOrElse(decodeLayout(assembled), () => interviewProfileLayout);
  const kinds = new Set(layout.blocks.map((block) => block.kind));
  if (!kinds.has(profileBlock.identity) || !kinds.has(profileBlock.actions)) {
    return interviewProfileLayout;
  }
  return layout;
}

function assembleProfileLayout(
  sheet: SheetData,
): Effect.Effect<ProfileLayoutData, never, ProfileLayoutAssembler> {
  return Effect.gen(function* program() {
    const assembler = yield* ProfileLayoutAssembler;
    const assembled = yield* assembler
      .assemble(sheet)
      .pipe(Effect.catchTag("LayoutFailed", () => Effect.succeed(undefined)));
    return resolvedLayout(sheet, assembled);
  });
}

export { ProfileLayoutAssembler, assembleProfileLayout };
