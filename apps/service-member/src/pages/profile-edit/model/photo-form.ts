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
    action.run(() => uploadPhoto(slot, file).then(() => onChanged().then(() => undefined)));
  }
  function handleRemove(): void {
    action.run(() => removePhoto(slot).then(() => onChanged().then(() => undefined)));
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
