import { RegistryProvider } from "@effect/atom-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { FIELD_STATUS } from "#shared/interview/index.ts";
import { InterviewScreen } from "./screen.tsx";

import type { InterviewViewData } from "#shared/interview/index.ts";
import type { ReactElement } from "react";

const noop = (): void => undefined;

const unansweredFields = [
  { key: "nickname", label: "呼び名", status: FIELD_STATUS.unanswered },
  { key: "occupation", label: "職種", status: FIELD_STATUS.unanswered },
  { key: "interests", label: "興味", status: FIELD_STATUS.unanswered },
  { key: "area", label: "活動エリア", status: FIELD_STATUS.unanswered },
  { key: "message", label: "ひとこと", status: FIELD_STATUS.unanswered },
] as const satisfies InterviewViewData["fields"];

function screenView(phase: InterviewViewData["phase"], text: string): InterviewViewData {
  return {
    fields: unansweredFields,
    messages: [{ role: "interviewer", text }],
    phase,
  };
}

function renderScreen(
  view: InterviewViewData,
  extra?: Readonly<{ failure?: string; heard?: string; turnFailed?: boolean; typing?: boolean }>,
): string {
  const screen: ReactElement = (
    <RegistryProvider>
      <InterviewScreen
        busy={false}
        failure={extra?.failure}
        heard={extra?.heard}
        onConsent={noop}
        onFinish={noop}
        onRestart={noop}
        onRetry={noop}
        onSave={noop}
        onSay={noop}
        turnFailed={extra?.turnFailed ?? false}
        typing={extra?.typing ?? false}
        view={view}
      />
    </RegistryProvider>
  );
  return renderToStaticMarkup(screen);
}

describe("interview screen", () => {
  it("opens on the first question with progress, a skip, and a way to stop", () => {
    expect.hasAssertions();
    const html = renderScreen(screenView("asking", "はじめまして。なんて呼べばいいですか？"));
    expect(html).toContain("なんて呼べばいいですか？");
    expect(html).toContain("0 / 5 項目");
    expect(html).toContain("ここで終える");
    expect(html).toContain("この質問はスキップ");
    expect(html).toContain("未回答");
    expect(html).not.toContain("この内容で保存");
  });

  it("offers save on the summary card and restart only after the sheet is saved", () => {
    expect.hasAssertions();
    expect(renderScreen(screenView("summary", "ここまでの内容をまとめました。"))).toContain(
      "この内容で保存",
    );
    expect(renderScreen(screenView("saved", "保存しました。"))).toContain("最初からやり直す");
  });

  it("asks for history consent instead of the composer after the first save", () => {
    expect.hasAssertions();
    const html = renderScreen(screenView("history_consent", "保存しました。"));
    expect(html).toContain("会話の履歴を残して、次からのレコメンドに使ってもよいですか？");
    expect(html).toContain("残す");
    expect(html).toContain("残さない");
    expect(html).not.toContain("メッセージ");
    expect(html).not.toContain("最初からやり直す");
  });

  it("keeps the member utterance and a retry when the next line never arrives", () => {
    expect.hasAssertions();
    const html = renderScreen(screenView("asking", "はじめまして。なんて呼べばいいですか？"), {
      failure: "今日はこれ以上話せません。",
      heard: "たろう",
      turnFailed: true,
      typing: false,
    });
    expect(html).toContain("たろう");
    expect(html).toContain("今日はこれ以上話せません。");
    expect(html).toContain("再試行");
    expect(html).toContain('data-speaker="member"');
  });
});
