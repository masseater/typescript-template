import type { ReactElement } from "react";

import { Button, ButtonLink } from "@repo/ui";

function ProfileActions({
  blocked,
  homeId,
}: Readonly<{ blocked: boolean; homeId: string }>): ReactElement {
  return (
    <div className="flex items-center gap-4">
      <Button type="submit" variant="primary" disabled={blocked}>
        保存
      </Button>
      <ButtonLink to="/users/$id" params={{ id: homeId }}>
        やめる
      </ButtonLink>
    </div>
  );
}

export { ProfileActions };
