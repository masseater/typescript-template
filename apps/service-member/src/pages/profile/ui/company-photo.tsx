import { PHOTO_SLOT } from "@repo/config";

import { memberPhotoUrl } from "#shared/api/index.ts";

import type { ReactElement } from "react";

function CompanyPhoto({
  memberId,
  version,
}: Readonly<{ memberId: string; version: string | null }>): ReactElement | null {
  const src = memberPhotoUrl(memberId, PHOTO_SLOT.company, version);
  if (src === undefined) {
    return null;
  }
  return (
    <img
      alt="会社の写真"
      className="aspect-video w-full rounded-lg border border-border object-cover"
      decoding="async"
      src={src}
    />
  );
}

export { CompanyPhoto };
