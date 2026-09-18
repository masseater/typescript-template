import type { ReactElement } from "react";

import { Button, ButtonLink } from "@template/ui";

function ProfileActions({
  homeId,
  pending,
}: Readonly<{ homeId: string; pending: boolean }>): ReactElement {
  return (
    <div className="flex items-center gap-4">
      <Button type="submit" variant="primary" disabled={pending}>
        保存
      </Button>
      <ButtonLink to="/users/$id" params={{ id: homeId }}>
        やめる
      </ButtonLink>
    </div>
  );
}

export { ProfileActions };
