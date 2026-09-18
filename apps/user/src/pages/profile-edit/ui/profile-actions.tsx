import { Button, ButtonLink } from "@template/ui";
import type { ReactElement } from "react";

function ProfileActions({ homeId }: Readonly<{ homeId: string }>): ReactElement {
  return (
    <div className="flex items-center gap-4">
      <Button type="submit" variant="primary">
        保存
      </Button>
      <ButtonLink to="/users/$id" params={{ id: homeId }}>
        やめる
      </ButtonLink>
    </div>
  );
}

export { ProfileActions };
