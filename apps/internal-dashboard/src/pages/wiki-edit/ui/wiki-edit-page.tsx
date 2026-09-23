import {
  Button,
  ButtonAnchor,
  ConfirmDialog,
  Field,
  STATUS_VARIANT,
  StatusMessage,
  localState,
  useAction,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";

import { discardDraft, saveDraft } from "#pages/wiki-edit/api/wiki-draft.ts";
import { wikiPageHref, writeWikiDocument } from "#shared/wiki-document/index.ts";
import { OpsPage } from "#widgets/ops-page/index.ts";
import { EditorToolbar } from "./editor-toolbar.tsx";
import { wikiEditorComponents, wikiEditorPlugins } from "./wiki-editor-plugins.ts";

import type { WikiEditorData } from "#pages/wiki-edit/model/wiki-editor-data.ts";
import type { ReactElement } from "react";

const useTitle = localState(Option.none<string>());
const useDescription = localState(Option.none<string>());
const useConfirmingDiscard = localState(false);

function WikiEditPage({ data }: Readonly<{ data: WikiEditorData }>): ReactElement {
  const { document, source } = data;
  const editor = usePlateEditor({
    components: wikiEditorComponents,
    plugins: wikiEditorPlugins,
    value: [...document.value],
  });
  const router = useRouter();
  const saving = useAction();
  const discarding = useAction();
  const [titleInput, setTitle] = useTitle();
  const [descriptionInput, setDescription] = useDescription();
  const [confirmingDiscard, setConfirmingDiscard] = useConfirmingDiscard();
  const title = Option.getOrElse(titleInput, () => document.title);
  const description = Option.getOrElse(descriptionInput, () => document.description);
  const version = source.draft?.version ?? 0;

  const save = (): Promise<void> =>
    Effect.runPromise(writeWikiDocument({ description, title, value: editor.children }))
      .then((markdown) =>
        saveDraft({ baseRevision: source.baseRevision, markdown, path: source.path, version }),
      )
      .then(() => router.invalidate());

  const discard = (): Promise<void> =>
    discardDraft(source.path, version).then(() => router.invalidate());

  return (
    <OpsPage title={`${document.title} を編集`}>
      <div className="flex w-full max-w-page flex-col gap-4">
        <Field
          label="タイトル"
          name="title"
          onValueChange={(next) => {
            setTitle(Option.some(next));
          }}
          required
          value={title}
        />
        <Field
          label="説明"
          multiline
          name="description"
          onValueChange={(next) => {
            setDescription(Option.some(next));
          }}
          required
          value={description}
        />
        <Plate editor={editor}>
          <EditorToolbar />
          <PlateContent
            aria-label="本文"
            className="min-h-96 max-w-none rounded-md border border-border bg-card p-4 outline-none focus-visible:focus-indicator-outer"
          />
        </Plate>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            action={() => {
              saving.run(save);
            }}
            disabled={saving.blocked}
            type="button"
            variant="primary"
          >
            下書きを保存
          </Button>
          {version === 0 ? null : (
            <Button
              disabled={discarding.blocked}
              onClick={() => {
                setConfirmingDiscard(true);
              }}
              type="button"
              variant="danger"
            >
              下書きを捨てる
            </Button>
          )}
          <ButtonAnchor href={wikiPageHref(source.path)} variant="secondary">
            ページに戻る
          </ButtonAnchor>
        </div>
        {version === 0 ? null : (
          <StatusMessage variant={STATUS_VARIANT.info}>
            下書きとして保存されています。公開されたページはまだ変わっていません。
          </StatusMessage>
        )}
        {saving.error === undefined ? null : (
          <StatusMessage variant={STATUS_VARIANT.failure}>{saving.error}</StatusMessage>
        )}
        {discarding.error === undefined ? null : (
          <StatusMessage variant={STATUS_VARIANT.failure}>{discarding.error}</StatusMessage>
        )}
      </div>
      <ConfirmDialog
        confirmLabel="捨てる"
        description="保存した下書きを消して、公開されている内容に戻します。"
        onConfirm={() => {
          setConfirmingDiscard(false);
          discarding.run(discard);
        }}
        onOpenChange={setConfirmingDiscard}
        open={confirmingDiscard}
        title="下書きを捨てますか"
        variant="danger"
      />
    </OpsPage>
  );
}

export { WikiEditPage };
