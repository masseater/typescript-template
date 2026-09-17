import type { ReactElement } from "react";
import type { SessionView } from "./protocol";
import { Status } from "./status";

function SessionStatus({ session }: Readonly<{ session: SessionView }>): ReactElement {
  return (
    <Status>
      {session.user.email}：{session.strong ? "強認証済み" : "追加認証が未完了です"}
    </Status>
  );
}

export { SessionStatus };
