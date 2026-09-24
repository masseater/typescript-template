import { STATUS_VARIANT } from "@repo/ui";

import { SessionStatus } from "./session-status.tsx";
import { useSessionGate } from "./use-session-gate.ts";

import type { Role } from "@repo/config";
import type { ReactElement } from "react";
import type { SessionView } from "./protocol.ts";

const SessionGate = ({
  children,
  role,
}: Readonly<{
  children: (session: SessionView) => ReactElement;
  role?: Role;
}>): ReactElement | null => {
  const { error, loading, session } = useSessionGate(role);
  if (loading) {
    return <SessionStatus variant={STATUS_VARIANT.pending}>{"読み込み中です。"}</SessionStatus>;
  }
  if (error !== undefined) {
    return <SessionStatus variant={STATUS_VARIANT.failure}>{error}</SessionStatus>;
  }
  return session === undefined ? null : children(session);
};

export { SessionGate };
