import { Button, ButtonLink } from "@template/ui/ui";
import type { ReactElement } from "react";
import { useMemo } from "react";

function ProfileActions({
  homeId,
  pending,
}: Readonly<{ homeId: string; pending: boolean }>): ReactElement {
  const home = useMemo(() => ({ id: homeId }), [homeId]);
  return (
    <div className="flex items-center gap-4">
      <Button type="submit" variant="primary" disabled={pending}>
        保存
      </Button>
      <ButtonLink to="/users/$id" params={home}>
        やめる
      </ButtonLink>
    </div>
  );
}

export { ProfileActions };
