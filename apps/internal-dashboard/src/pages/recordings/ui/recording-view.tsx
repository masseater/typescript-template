import { RECORDING_STATUS } from "@repo/config";
import { Button, ConfirmDialog, Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { clockOf, statusLabels } from "#pages/recordings/model/recording-labels.ts";
import { SpeakerNames } from "./speaker-names.tsx";
import { TranscriptSection } from "./transcript-section.tsx";

import type { RecordingActions, RecordingDetail } from "#pages/recordings/model/recording-state.ts";
import type { RecordingFailure } from "@repo/config";
import type { ReactElement } from "react";

const failureLabels: Readonly<Record<RecordingFailure, string>> = {
  audio_missing: "録音ファイルが見つかりませんでした。",
  enqueue_failed: "文字起こしの順番待ちに入れられませんでした。",
  output_unreadable: "文字起こしの結果を読み取れませんでした。",
  model_rejected: "文字起こしのモデルが失敗しました。",
  ai_unbound: "文字起こしのモデルを使えない環境です。",
};

function RecordingView({
  actions,
  onRefresh,
  recording,
}: Readonly<{
  actions: RecordingActions;
  onRefresh: () => Promise<void>;
  recording: RecordingDetail;
}>): ReactElement {
  const { durationMs, failure, status, title } = recording.recording;
  return (
    <Page title={title}>
      <StatusMessage
        variant={status === RECORDING_STATUS.failed ? STATUS_VARIANT.failure : STATUS_VARIANT.empty}
      >
        {statusLabels[status]}
        {durationMs === null ? "" : `（${clockOf(durationMs)}）`}
        {failure === null ? "" : ` ${failureLabels[failure]}`}
      </StatusMessage>
      <div className="flex items-center gap-4">
        <Button type="button" disabled={actions.blocked} action={onRefresh}>
          状態を更新する
        </Button>
        {status === RECORDING_STATUS.failed ? (
          <Button
            type="button"
            variant="primary"
            disabled={actions.blocked}
            action={() => {
              actions.handleRetry();
            }}
          >
            やり直す
          </Button>
        ) : null}
        <Button
          type="button"
          variant="danger"
          disabled={actions.blocked}
          action={() => {
            actions.handleDeleteOpenChange(true);
          }}
        >
          削除する
        </Button>
      </div>
      {actions.error === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.failure}>{actions.error}</StatusMessage>
      )}
      {recording.speakers.length === 0 ? null : (
        <SpeakerNames
          disabled={actions.blocked}
          recording={recording}
          onAssign={actions.handleAssign}
        />
      )}
      {recording.segments.length === 0 ? null : <TranscriptSection recording={recording} />}
      <ConfirmDialog
        open={actions.confirmingDelete}
        onOpenChange={actions.handleDeleteOpenChange}
        title="録音を削除しますか？"
        description={`「${title}」の音声と書き起こしを削除します。この操作は取り消せません。`}
        confirmLabel="削除する"
        variant="danger"
        onConfirm={actions.handleConfirmDelete}
      />
    </Page>
  );
}

export { RecordingView };
