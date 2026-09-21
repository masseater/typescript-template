import { useAction } from "@repo/ui";

import { removePhoto, uploadPhoto } from "#pages/profile-edit/api/photo.ts";

import type { PhotoSlot } from "@repo/config";

interface PhotoForm {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleFile: (file: File | undefined) => void;
  readonly handleRemove: () => void;
  readonly pending: boolean;
}

function usePhotoForm(slot: PhotoSlot, onChanged: () => Promise<void>): PhotoForm {
  const action = useAction();
  function handleFile(file: File | undefined): void {
    if (file === undefined) {
      return;
    }
    action.run(async () => {
      await uploadPhoto(slot, file);
      await onChanged();
    });
  }
  function handleRemove(): void {
    action.run(async () => {
      await removePhoto(slot);
      await onChanged();
    });
  }
  return {
    blocked: action.blocked,
    error: action.error,
    handleFile,
    handleRemove,
    pending: action.pending,
  };
}

export { usePhotoForm };
