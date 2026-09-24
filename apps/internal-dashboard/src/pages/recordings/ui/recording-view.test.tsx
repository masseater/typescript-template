import { RECORDING_FAILURE, RECORDING_STATUS } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { RecordingView } from "./recording-view.tsx";

import type { RecordingActions, RecordingDetail } from "#pages/recordings/model/recording-state.ts";

const idle: RecordingActions = {
  blocked: false,
  confirmingDelete: false,
  error: undefined,
  handleAssign: () => undefined,
  handleConfirmDelete: () => undefined,
  handleDeleteOpenChange: () => undefined,
  handleRetry: () => undefined,
};

const transcribed: RecordingDetail = {
  people: [{ consentedAt: 0, id: "person-1", name: "山田" }],
  recording: {
    createdAt: 0,
    durationMs: 65_000,
    failure: null,
    id: "recording-1",
    ownerName: null,
    status: RECORDING_STATUS.done,
    title: "定例",
  },
  segments: [{ endMs: 1500, speakerLabel: 0, startMs: 0, text: "始めます。" }],
  speakers: [{ label: 0, person: null }],
};

const failed: RecordingDetail = {
  people: [],
  recording: {
    ...transcribed.recording,
    durationMs: null,
    failure: RECORDING_FAILURE.audioMissing,
    status: RECORDING_STATUS.failed,
  },
  segments: [],
  speakers: [],
};

function rendered(recording: RecordingDetail, actions: Partial<RecordingActions> = {}): string {
  return renderedAt(
    <RecordingView
      actions={{ ...idle, ...actions }}
      onRefresh={() => Promise.resolve()}
      recording={recording}
    />,
    ["/"],
  );
}

describe("recording detail", () => {
  it("shows the status with the recording length", () => {
    expect(rendered(transcribed)).toContain("完了（1:05）");
  });

  it("shows the transcript", () => {
    expect(rendered(transcribed)).toContain("始めます。");
  });

  it("offers no retry for a finished recording", () => {
    expect(rendered(transcribed)).not.toContain("やり直す");
  });

  it("explains why the recording failed", () => {
    expect(rendered(failed)).toContain("失敗 録音ファイルが見つかりませんでした。");
  });

  it("offers a retry for a failed recording", () => {
    expect(rendered(failed)).toContain("やり直す");
  });

  it("hides the speakers when there are none", () => {
    expect(rendered(failed)).not.toContain('id="speakers-heading"');
  });

  it("shows the action failure", () => {
    expect(rendered(transcribed, { error: "削除できませんでした。" })).toContain(
      "削除できませんでした。",
    );
  });
});
