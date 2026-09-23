import { Button, Field, FormColumn, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useUploadForm } from "#pages/recordings/model/upload-form.ts";
import { maximumRecordingTitleLength } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function UploadSection({
  onUploaded,
}: Readonly<{ onUploaded: (recordingId: string) => Promise<void> }>): ReactElement {
  const form = useUploadForm(onUploaded);
  return (
    <section aria-labelledby="upload-heading" className="flex flex-col gap-4">
      <Heading as="h2" size="section">
        <span id="upload-heading">録音をアップロード</span>
      </Heading>
      <p className="text-base leading-normal text-muted-foreground">
        100 MB までの音声か動画を選ぶと、話者を分けて文字起こしします。1
        時間の会議で数分かかります。
      </p>
      <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
        <FormColumn>
          <Field
            label="題"
            name="title"
            required
            maxLength={maximumRecordingTitleLength}
            value={form.title}
            onValueChange={form.handleTitleChange}
          />
          <label className="flex flex-col gap-2 text-base font-bold text-foreground">
            録音ファイル
            <input
              accept="audio/*,video/*"
              className="text-base font-normal text-foreground"
              name="audio"
              required
              type="file"
              onChange={(change) => {
                form.handleAudioChange(change.currentTarget.files?.[0]);
              }}
            />
          </label>
          <div>
            <Button type="submit" variant="primary" disabled={form.blocked}>
              アップロードする
            </Button>
          </div>
          {form.error === undefined ? null : (
            <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
          )}
        </FormColumn>
      </form>
    </section>
  );
}

export { UploadSection };
