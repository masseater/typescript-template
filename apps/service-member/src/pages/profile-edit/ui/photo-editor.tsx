import { photoSlots } from "@repo/config";
import { useRouter } from "@tanstack/react-router";

import { PhotoSlotEditor } from "./photo-slot-editor.tsx";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import type { ReactElement } from "react";

function PhotoEditor({ profile }: Readonly<{ profile: Profile }>): ReactElement {
  const router = useRouter();
  async function refresh(): Promise<void> {
    await router.invalidate();
  }
  return (
    <div className="flex flex-col gap-6">
      {photoSlots.map((slot) => (
        <PhotoSlotEditor
          key={slot}
          memberId={profile.id}
          name={profile.name}
          onChanged={refresh}
          slot={slot}
          version={profile.photos[slot]}
        />
      ))}
    </div>
  );
}

export { PhotoEditor };
