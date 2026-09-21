import { PHOTO_SLOT, maximumPhotoMebibytes, photoContentTypes } from "@repo/config";
import { Avatar, Button, FileField, Heading, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { usePhotoForm } from "#pages/profile-edit/model/photo-form.ts";
import { memberPhotoUrl } from "#shared/api/index.ts";

import type { PhotoSlot } from "@repo/config";
import type { ReactElement } from "react";

const accept = photoContentTypes.join(",");
const hint = `JPEG・PNG・WebP、${maximumPhotoMebibytes} MB まで。位置情報などのメタデータは保存時に取り除きます。`;

const slotLabels = {
  [PHOTO_SLOT.face]: "顔写真",
  [PHOTO_SLOT.company]: "会社の写真",
} as const satisfies Record<PhotoSlot, string>;

function Preview({
  memberId,
  name,
  slot,
  version,
}: Readonly<{
  memberId: string;
  name: string;
  slot: PhotoSlot;
  version: string | null;
}>): ReactElement {
  const src = memberPhotoUrl(memberId, slot, version);
  if (slot === PHOTO_SLOT.face) {
    return <Avatar name={name} size="large" src={src} />;
  }
  return src === undefined ? (
    <p className="text-sm leading-normal text-muted-foreground">まだ登録されていません。</p>
  ) : (
    <img
      alt={`現在の${slotLabels[slot]}`}
      className="aspect-video w-full rounded-lg border border-border object-cover"
      decoding="async"
      src={src}
    />
  );
}

function PhotoSlotEditor({
  memberId,
  name,
  onChanged,
  slot,
  version,
}: Readonly<{
  memberId: string;
  name: string;
  onChanged: () => Promise<void>;
  slot: PhotoSlot;
  version: string | null;
}>): ReactElement {
  const form = usePhotoForm(slot, onChanged);
  const label = slotLabels[slot];
  return (
    <section aria-busy={form.pending} className="flex flex-col gap-3">
      <Heading as="h2" size="section">
        {label}
      </Heading>
      <Preview memberId={memberId} name={name} slot={slot} version={version} />
      <FileField
        accept={accept}
        disabled={form.blocked}
        hint={hint}
        label={`${label}を選ぶ`}
        name={`${slot}-photo`}
        onFileChange={form.handleFile}
      />
      {version !== null && (
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={form.blocked}
            onClick={form.handleRemove}
          >
            {label}を削除
          </Button>
        </div>
      )}
      {form.error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
      )}
    </section>
  );
}

export { PhotoSlotEditor };
