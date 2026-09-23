import { toggleList } from "@platejs/list";
import { insertImage } from "@platejs/media";
import { Button, STATUS_VARIANT, StatusMessage, useAction } from "@repo/ui";
import { KEYS } from "platejs";
import { useEditorRef } from "platejs/react";

import { uploadImage } from "#pages/wiki-edit/api/wiki-draft.ts";
import { wikiImageTypes } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

type ImageType = (typeof wikiImageTypes)[number];

const imageTypes: ReadonlySet<string> = new Set(wikiImageTypes);

function isImageType(type: string): type is ImageType {
  return imageTypes.has(type);
}

function EditorToolbar(): ReactElement {
  const editor = useEditorRef();
  const upload = useAction();

  const block = (type: string) => (): void => {
    editor.tf.toggleBlock(type);
    editor.tf.focus();
  };
  const mark = (key: string) => (): void => {
    editor.tf.toggleMark(key);
    editor.tf.focus();
  };
  const list = (listStyleType: string) => (): void => {
    toggleList(editor, { listStyleType });
    editor.tf.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div aria-label="書式" className="flex flex-wrap gap-2" role="toolbar">
        <Button onClick={block(KEYS.h2)} size="small" type="button">
          見出し
        </Button>
        <Button onClick={block(KEYS.h3)} size="small" type="button">
          小見出し
        </Button>
        <Button onClick={mark(KEYS.bold)} size="small" type="button">
          太字
        </Button>
        <Button onClick={mark(KEYS.code)} size="small" type="button">
          コード
        </Button>
        <Button onClick={list(KEYS.ul)} size="small" type="button">
          箇条書き
        </Button>
        <Button onClick={list(KEYS.ol)} size="small" type="button">
          番号付き
        </Button>
        <Button onClick={block(KEYS.blockquote)} size="small" type="button">
          引用
        </Button>
        <Button onClick={block(KEYS.codeBlock)} size="small" type="button">
          コードブロック
        </Button>
        <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 text-sm focus-within:focus-indicator-outer">
          画像
          <input
            accept={wikiImageTypes.join(",")}
            className="sr-only"
            disabled={upload.blocked}
            name="image"
            onChange={(change) => {
              const file = change.currentTarget.files?.[0];
              change.currentTarget.value = "";
              if (file === undefined) {
                return;
              }
              const { type } = file;
              upload.run(() =>
                isImageType(type)
                  ? uploadImage(file, type).then((url) => {
                      insertImage(editor, url);
                    })
                  : Promise.reject(new Error("PNG・JPEG・GIF・WebP の画像を選んでください。")),
              );
            }}
            type="file"
          />
        </label>
      </div>
      {upload.pending ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>画像を送っています。</StatusMessage>
      ) : null}
      {upload.error === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.failure}>{upload.error}</StatusMessage>
      )}
    </div>
  );
}

export { EditorToolbar };
