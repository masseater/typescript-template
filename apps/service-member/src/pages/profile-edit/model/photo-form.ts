import { useAction } from "@repo/ui";
import { useState } from "react";

import { removePhoto, uploadPhoto } from "#pages/profile-edit/api/photo.ts";

import type { PhotoSlot } from "@repo/config";

interface PhotoForm {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleFile: (file: File | undefined) => void;
  readonly handleRemove: () => void;
  readonly pending: boolean;
  readonly version: string | null;
}

function usePhotoForm(
  slot: PhotoSlot,
  initialVersion: string | null,
  onChanged: () => Promise<void>,
): PhotoForm {
  const [version, setVersion] = useState(initialVersion);
  const action = useAction();
  function handleFile(file: File | undefined): void {
    if (file === undefined) {
      return;
    }
    action.run(async () => {
      const state = await uploadPhoto(slot, file);
      setVersion(state.version);
      await onChanged();
    });
  }
  function handleRemove(): void {
    action.run(async () => {
      const state = await removePhoto(slot);
      setVersion(state.version);
      await onChanged();
    });
  }
  return {
    blocked: action.blocked,
    error: action.error,
    handleFile,
    handleRemove,
    pending: action.pending,
    version,
  };
}

export { usePhotoForm };
export type { PhotoForm };
